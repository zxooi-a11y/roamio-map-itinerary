import test from 'node:test';
import assert from 'node:assert/strict';
import { autoTimes, estimateSeconds, legSeconds, minSeconds, reassignTimes } from './timing.js';

const BRISTOL = { lat: 51.4545, lng: -2.5879 };
const LONDON = { lat: 51.5074, lng: -0.1278 };
const st = (id, time = '') => ({ id, time });

test('Bristol to London is never minutes, whatever the routing service says', () => {
  const car = legSeconds(BRISTOL, LONDON, 'car', { status: 'ok', dur: 300 }); // a bad answer: 5 minutes
  assert.ok(car >= 90 * 60, `driving ${car / 60} min`);
  assert.ok(estimateSeconds(BRISTOL, LONDON, 'car') >= 90 * 60 && estimateSeconds(BRISTOL, LONDON, 'car') <= 4 * 3600);
  assert.ok(legSeconds(BRISTOL, LONDON, 'foot', undefined) >= 24 * 3600); // no route: the estimate, a day of walking
  assert.ok(legSeconds(BRISTOL, LONDON, 'foot', { status: 'ok', dur: 7000, approx: true }) >= 24 * 3600); // car time from a car-only server
  assert.ok(minSeconds(BRISTOL, LONDON, 'bike') > minSeconds(BRISTOL, LONDON, 'car'));
});

test('a routed time is used when it is believable', () => {
  const a = { lat: 0, lng: 0 }, b = { lat: 0, lng: 0.01 }; // ~1.1 km
  assert.equal(legSeconds(a, b, 'foot', { status: 'ok', dur: 1000 }), 1000);
});

test('reordering hands the timetable out in order', () => {
  const out = reassignTimes([st('night', '20:00'), st('a', '07:00'), st('b', '09:30'), st('free')]);
  assert.deepEqual(out.map((s) => s.time), ['07:00', '09:30', '20:00', '']);
  assert.equal(reassignTimes([st('a', '08:00'), st('b', '09:00')]).length, 2);
  const same = [st('a', '08:00'), st('b', '09:00')];
  assert.equal(reassignTimes(same), same); // nothing to change keeps the same array
});

test('each stop\'s time follows from the one before', () => {
  // 07:38 start, 2 h 10 min to the next: 09:48 -> 09:50 (to the next 5 minutes); 20 min after that: 10:10
  const r = autoTimes([st('a', '07:38'), st('b', '21:50'), st('c')], [0, 7800, 1200]);
  assert.deepEqual(r.stops.map((s) => s.time), ['07:38', '09:50', '10:10']);
  assert.equal(r.changed, true);
  assert.equal(autoTimes(r.stops, [0, 7800, 1200]).changed, false); // already following: nothing more to do
  const same = [st('a', '07:00'), st('b', '07:30')];
  assert.equal(autoTimes(same, [0, 1800]).stops, same);
});

test('a typed time (pin) is kept if it leaves enough time, and moved later if not; no start time means no change', () => {
  const kept = autoTimes([st('a', '09:00'), { ...st('b', '20:00'), pin: true }, st('c')], [0, 1800, 600]);
  assert.deepEqual(kept.stops.map((s) => s.time), ['09:00', '20:00', '20:10']); // dinner stays at 8pm, the next follows it
  const late = autoTimes([st('a', '07:00'), { ...st('b', '07:10'), pin: true }], [0, 6600]);
  assert.equal(late.stops[1].time, '08:50');
  const none = [st('a'), st('b', '12:00')];
  assert.equal(autoTimes(none, [0, 600]).stops, none);
});

test('running past midnight is held at 23:59 and reported', () => {
  const r = autoTimes([st('a', '23:00'), st('b')], [0, 7200]);
  assert.equal(r.stops[1].time, '23:59');
  assert.equal(r.overflow, true);
});

test('public transport is modelled from the road distance of the journey, never below its floor', () => {
  // Bristol -> London by public transport: about 2 hours, whatever the car route says
  const t = legSeconds(BRISTOL, LONDON, 'transit', { status: 'ok', dist: 185000, dur: 300, approx: true });
  assert.ok(t >= 90 * 60 && t <= 3.5 * 3600, `transit ${t / 60} min`);
  assert.ok(legSeconds(BRISTOL, LONDON, 'transit', undefined) >= 90 * 60);
  // short hop: waiting dominates
  const a = { lat: 51.5, lng: -0.1 }, b = { lat: 51.51, lng: -0.1 };
  assert.ok(legSeconds(a, b, 'transit', { status: 'ok', dist: 1100 }) >= 600);
});

test('a train between cities takes about as long as the real one', () => {
  const t = legSeconds(BRISTOL, LONDON, 'train', { status: 'ok', dur: 0 });
  assert.ok(t >= 90 * 60 && t <= 2.75 * 3600, `train ${t / 60} min`);
  assert.ok(t < legSeconds(BRISTOL, LONDON, 'foot'));
});
