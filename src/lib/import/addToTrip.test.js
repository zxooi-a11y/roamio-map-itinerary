import test from 'node:test';
import assert from 'node:assert/strict';
import { assignOffsets, buildStops, rangeSpan } from './addToTrip.js';
import { tripsReducer } from '../../store/tripsReducer.js';

const P = (name, extra = {}) => ({ name, lat: 1, lng: 2, ...extra });

test('places are spread evenly over the range in file order; dates and day numbers are honoured', () => {
  assert.deepEqual(assignOffsets([P('a'), P('b'), P('c'), P('d')], { start: '2026-07-01', span: 2 }), [0, 0, 1, 1]);
  assert.deepEqual(assignOffsets([P('a'), P('b'), P('c')], { start: '2026-07-01', span: 3 }), [0, 1, 2]);
  assert.deepEqual(assignOffsets([P('a', { day: { date: '2026-07-03' } }), P('b'), P('c', { day: { n: 2 } }), P('d')], { start: '2026-07-01', span: 3 }), [2, 0, 1, 1]);
  // outside the range is clamped into it
  assert.deepEqual(assignOffsets([P('a', { day: { date: '2026-08-01' } }), P('b', { day: { date: '2026-06-01' } })], { start: '2026-07-01', span: 3 }), [2, 0]);
  assert.equal(rangeSpan('2026-07-01', '2026-07-04'), 4);
});

test('stops are built from places; unfound ones go to the fallback or are skipped', () => {
  const places = [P('A', { time: '09:00' }), { name: 'Lost', lat: null, lng: null }];
  const r = buildStops(places, { start: '', span: 1, fallback: { lat: 5, lng: 6 } });
  assert.deepEqual([r.placed, r.unplaced, r.skipped], [1, 1, 0]);
  assert.equal(r.items[0].stop.pin, true);
  assert.deepEqual([r.items[1].stop.lat, r.items[1].stop.lng], [5, 6]);
  const none = buildStops([{ name: 'Lost', lat: null, lng: null }], { span: 1 });
  assert.equal(none.skipped, 1);
});

const trip = (days) => [{ id: 't', updatedAt: 0, days }];
const d = (id, date, stops = []) => ({ id, date, mode: 'foot', stops });

test('importing adds stops on the dates and extends the trip to cover the range', () => {
  const stop = (id) => ({ id, name: id, lat: 0, lng: 0, time: '' });
  const next = tripsReducer(trip([d('a', '2026-07-02', [stop('old')])]), {
    type: 'trip/importPlaces', tripId: 't', start: '2026-07-01', end: '2026-07-04',
    items: [{ offset: 0, stop: stop('n1') }, { offset: 1, stop: stop('n2') }, { offset: 3, stop: stop('n3') }],
  });
  const days = next[0].days;
  assert.deepEqual(days.map((x) => x.date), ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04']);
  assert.deepEqual(days.map((x) => x.stops.map((s) => s.id)), [['n1'], ['old', 'n2'], [], ['n3']]);
  assert.equal(days[1].retime, true);
});

test('an undated trip imported without dates gets the places by day number, adding days', () => {
  const stop = (id) => ({ id, name: id, lat: 0, lng: 0, time: '' });
  const next = tripsReducer(trip([d('a', '')]), { type: 'trip/importPlaces', tripId: 't', start: '', end: '', items: [{ offset: 0, stop: stop('x') }, { offset: 2, stop: stop('y') }] });
  assert.deepEqual(next[0].days.map((x) => x.stops.map((s) => s.id)), [['x'], [], ['y']]);
});

test('an undated trip imported with dates takes those dates', () => {
  const stop = (id) => ({ id, name: id, lat: 0, lng: 0, time: '' });
  const next = tripsReducer(trip([d('a', '')]), { type: 'trip/importPlaces', tripId: 't', start: '2026-07-01', end: '2026-07-02', items: [{ offset: 0, stop: stop('x') }, { offset: 1, stop: stop('y') }] });
  assert.deepEqual(next[0].days.map((x) => [x.date, x.stops.map((s) => s.id)]), [['2026-07-01', ['x']], ['2026-07-02', ['y']]]);
});
