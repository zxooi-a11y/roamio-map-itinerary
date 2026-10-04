import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffTrips } from './diffTrips.js';
import { tripsReducer } from './tripsReducer.js';

const trip = (id, extra = {}) => ({ id, title: id, updatedAt: 0, days: [{ id: 'd', date: '', stops: [] }], ...extra });
const mapOf = (trips) => new Map(trips.map((t) => [t.id, t]));

test('diffTrips finds added, changed and removed trips', () => {
  const a = trip('a'), b = trip('b'), c = trip('c');
  const before = mapOf([a, b]);
  const edited = { ...b, title: 'B2' };
  const { upserts, deletes, next } = diffTrips(before, [edited, c]);
  assert.deepEqual(upserts, ['b', 'c']);
  assert.deepEqual(deletes, ['a']);
  assert.equal(next.get('b'), edited);
});

test('diffTrips reports nothing when nothing changed', () => {
  const a = trip('a');
  const { upserts, deletes } = diffTrips(mapOf([a]), [a]);
  assert.deepEqual([upserts, deletes], [[], []]);
});

test('an edit through the reducer changes only that trip', () => {
  const trips = [trip('a'), trip('b')];
  const next = tripsReducer(trips, { type: 'day/update', tripId: 'b', dayId: 'd', patch: { title: 'x' } });
  assert.deepEqual(diffTrips(mapOf(trips), next).upserts, ['b']);
});

test('trips/load replaces everything and is not seen as a change', () => {
  const loaded = [trip('a')];
  const state = tripsReducer([trip('old')], { type: 'trips/load', trips: loaded });
  assert.equal(state, loaded);
  const { upserts, deletes } = diffTrips(mapOf(loaded), state);
  assert.deepEqual([upserts, deletes], [[], []]);
});
