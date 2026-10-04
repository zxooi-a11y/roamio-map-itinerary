import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripsReducer } from './tripsReducer.js';

const s = (id, extra = {}) => ({ id, name: id, lat: 0, lng: 0, ...extra });
const base = () => [{
  id: 't', updatedAt: 0, days: [
    { id: 'a', date: '2026-07-01', stops: [s('a1'), s('a2'), s('a3')] },
    { id: 'b', date: '', stops: [s('b1')] },
  ],
}];
const ids = (trips, dayIdx) => trips[0].days[dayIdx].stops.map((x) => x.id);

test('stop/move reorders within a day', () => {
  const next = tripsReducer(base(), { type: 'stop/move', tripId: 't', stopId: 'a1', toDayId: 'a', toIndex: 2 });
  assert.deepEqual(ids(next, 0), ['a2', 'a3', 'a1']);
});

test('stop/move moves across days', () => {
  const next = tripsReducer(base(), { type: 'stop/move', tripId: 't', stopId: 'a2', toDayId: 'b', toIndex: 0 });
  assert.deepEqual(ids(next, 0), ['a1', 'a3']);
  assert.deepEqual(ids(next, 1), ['a2', 'b1']);
});

test('reducer never mutates and bumps updatedAt on edits only', () => {
  const before = base();
  const frozen = JSON.stringify(before);
  const edited = tripsReducer(before, { type: 'day/update', tripId: 't', dayId: 'b', patch: { title: 'Beach' } });
  assert.equal(JSON.stringify(before), frozen);
  assert.equal(edited[0].days[1].title, 'Beach');
  assert.ok(edited[0].updatedAt > 0);
  assert.equal(edited[0].days[0], before[0].days[0]); // untouched day keeps its identity

  const collapsed = tripsReducer(before, { type: 'day/setCollapsed', tripId: 't', dayId: 'a', collapsed: true });
  assert.equal(collapsed[0].updatedAt, 0);
  assert.equal(collapsed[0].days[0].collapsed, true);
});

test('day/add continues the dates', () => {
  const next = tripsReducer(base(), { type: 'day/add', tripId: 't' });
  assert.equal(next[0].days.length, 3);
  assert.equal(next[0].days[2].date, ''); // last day (b) is undated
  const fromDated = tripsReducer(tripsReducer(base(), { type: 'day/remove', tripId: 't', dayId: 'b' }), { type: 'day/add', tripId: 't' });
  assert.equal(fromDated[0].days[1].date, '2026-07-02');
});

test('stop/update finds the stop in any day', () => {
  const next = tripsReducer(base(), { type: 'stop/update', tripId: 't', stopId: 'b1', patch: { cat: 'Park' } });
  assert.equal(next[0].days[1].stops[0].cat, 'Park');
});
