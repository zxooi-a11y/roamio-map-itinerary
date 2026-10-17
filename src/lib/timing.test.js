import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateSeconds, legSeconds, legTimings, minSeconds, reassignTimes, retimeDay } from './timing.js';

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

test('a stop is pushed later when there is not enough time to get there', () => {
  // 07:00 at A, then B at 07:10 but the way takes 1 h 50: B moves to 08:50
  const r = retimeDay([st('a', '07:00'), st('b', '07:10'), st('c', '09:00')], [0, 6600, 600]);
  assert.deepEqual(r.stops.map((s) => s.time), ['07:00', '08:50', '09:00']);
  assert.equal(r.changed, true);
  // each push carries on: C needs 10 min after the new 08:50
  const r2 = retimeDay([st('a', '07:00'), st('b', '07:10'), st('c', '08:55')], [0, 6600, 600]);
  assert.deepEqual(r2.stops.map((s) => s.time), ['07:00', '08:50', '09:00']);
});

test('enough time, or no times at all, changes nothing; blank stops still use up travel time', () => {
  const ok = [st('a', '07:00'), st('b', '10:00')];
  assert.equal(retimeDay(ok, [0, 1800]).stops, ok);
  const none = [st('a'), st('b')];
  assert.equal(retimeDay(none, [0, 1800]).changed, false);
  const blank = retimeDay([st('a', '07:00'), st('b'), st('c', '07:30')], [0, 3600, 1800]);
  assert.equal(blank.stops[2].time, '08:30'); // 07:00 + 1 h + 30 min
});

test('running past midnight is held at 23:59 and reported', () => {
  const r = retimeDay([st('a', '23:00'), st('b', '23:10')], [0, 7200]);
  assert.equal(r.stops[1].time, '23:59');
  assert.equal(r.overflow, true);
});

test('leg timings give the arrival and flag a stop that is too soon or earlier than the one before', () => {
  const t = legTimings([st('a', '07:00'), st('b', '07:10'), st('c', '06:00'), st('d')], [0, 3600, 600, 600]);
  assert.deepEqual([t.b.arrive, t.b.short], ['08:00', 50]);
  assert.equal(t.c.backwards, true);
  assert.equal(t.d.arrive !== null, true);
});
