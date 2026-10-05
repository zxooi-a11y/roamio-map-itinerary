import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateRange, describePlan, effectiveDates, planDates } from './tripDates.js';
import { tripsReducer } from '../store/tripsReducer.js';

const stop = (id) => ({ id, name: id, lat: 0, lng: 0, time: '', note: '' });
const day = (id, date, stops = []) => ({ id, date, title: '', mode: 'foot', stops: stops.map(stop) });
// Mar 3, 4, 5 with stops on the 3rd and 5th
const trip = () => ({ id: 't', title: 'T', days: [day('a', '2027-03-03', ['a1', 'a2']), day('b', '2027-03-04'), day('c', '2027-03-05', ['c1'])] });
const dates = (p) => p.days.map((d) => d.date);
const ids = (p) => p.days.map((d) => d.id);

test('extending the end adds empty days after, keeping the existing days untouched', () => {
  const t = trip();
  const p = planDates(t, { start: '2027-03-03', end: '2027-03-07' }, 'end');
  assert.deepEqual(dates(p), ['2027-03-03', '2027-03-04', '2027-03-05', '2027-03-06', '2027-03-07']);
  assert.deepEqual(ids(p).slice(0, 3), ['a', 'b', 'c']);
  assert.equal(p.days[0], t.days[0]); // same objects: nothing was copied or lost
  assert.deepEqual([p.added, p.droppedDays, p.droppedStops, p.shifted], [2, 0, 0, false]);
  assert.ok(p.days.slice(3).every((d) => d.stops.length === 0 && d.title === ''));
});

test('extending the start adds days BEFORE, and existing days keep their calendar dates', () => {
  const p = planDates(trip(), { start: '2027-03-01', end: '2027-03-05' }, 'start');
  assert.deepEqual(dates(p), ['2027-03-01', '2027-03-02', '2027-03-03', '2027-03-04', '2027-03-05']);
  assert.deepEqual(ids(p).slice(2), ['a', 'b', 'c']);       // the stops stay on Mar 3 / Mar 5
  assert.deepEqual(p.days[2].stops.map((s) => s.id), ['a1', 'a2']);
  assert.equal(p.added, 2);
});

test('shortening removes the days outside the range and counts what would be lost', () => {
  const p = planDates(trip(), { start: '2027-03-04', end: '2027-03-05' }, 'start');
  assert.deepEqual(ids(p), ['b', 'c']);
  assert.deepEqual([p.droppedDays, p.droppedStops], [1, 2]); // day "a" had 2 stops
  const q = planDates(trip(), { start: '2027-03-03', end: '2027-03-04' }, 'end');
  assert.deepEqual([ids(q), q.droppedDays, q.droppedStops], [['a', 'b'], 1, 1]);
});

test('shortening past empty days loses nothing', () => {
  const t = { id: 't', days: [day('a', '2027-03-03', ['a1']), day('b', '2027-03-04'), day('c', '2027-03-05')] };
  const p = planDates(t, { start: '2027-03-03', end: '2027-03-03' }, 'end');
  assert.deepEqual([ids(p), p.droppedDays, p.droppedStops], [['a'], 2, 0]);
});

test('moving the start past the end shifts the whole trip: same length, nothing lost', () => {
  const p = planDates(trip(), { start: '2027-03-10', end: '2027-03-05' }, 'start');
  assert.deepEqual(dates(p), ['2027-03-10', '2027-03-11', '2027-03-12']);
  assert.deepEqual(ids(p), ['a', 'b', 'c']);
  assert.deepEqual([p.shifted, p.added, p.droppedDays, p.droppedStops], [true, 0, 0, 0]);
  assert.deepEqual([p.start, p.end], ['2027-03-10', '2027-03-12']);
});

test('moving the end before the start shifts the trip earlier', () => {
  const p = planDates(trip(), { start: '2027-03-03', end: '2027-02-20' }, 'end');
  assert.deepEqual(dates(p), ['2027-02-18', '2027-02-19', '2027-02-20']);
  assert.equal(p.shifted, true);
});

test('shifting works across month and year boundaries and leap days', () => {
  const t = { id: 't', days: [day('a', '2027-12-30'), day('b', '2027-12-31'), day('c', '2028-01-01')] };
  assert.deepEqual(dates(planDates(t, { start: '2028-02-28', end: '2027-12-31' }, 'start')), ['2028-02-28', '2028-02-29', '2028-03-01']);
});

test('a trip with no dates takes them from one field and keeps its number of days', () => {
  const t = { id: 't', days: [day('a', '', ['a1']), day('b', ''), day('c', '')] };
  const p = planDates(t, { start: '2027-06-01', end: '' }, 'start');
  assert.deepEqual([dates(p), p.end, ids(p)], [['2027-06-01', '2027-06-02', '2027-06-03'], '2027-06-03', ['a', 'b', 'c']]);
  const q = planDates(t, { start: '', end: '2027-06-10' }, 'end');
  assert.deepEqual([dates(q)[0], q.start], ['2027-06-08', '2027-06-08']);
});

test('a trip with no dates and both fields set grows or shrinks to the range', () => {
  const t = { id: 't', days: [day('a', '', ['a1']), day('b', ''), day('c', '', ['c1'])] };
  const longer = planDates(t, { start: '2027-06-01', end: '2027-06-05' }, 'end');
  assert.deepEqual([dates(longer).length, longer.added, ids(longer).slice(0, 3)], [5, 2, ['a', 'b', 'c']]);
  const shorter = planDates(t, { start: '2027-06-01', end: '2027-06-02' }, 'end');
  assert.deepEqual([ids(shorter), shorter.droppedDays, shorter.droppedStops], [['a', 'b'], 1, 1]);
});

test('days without a date between dated ones are placed by position', () => {
  assert.deepEqual(effectiveDates([day('a', '2027-03-03'), day('b', ''), day('c', '')]), ['2027-03-03', '2027-03-04', '2027-03-05']);
  assert.deepEqual(effectiveDates([day('a', ''), day('b', '2027-03-04')]), ['2027-03-03', '2027-03-04']);
  assert.equal(effectiveDates([day('a', '')]), null);
  assert.deepEqual(dateRange({ days: [day('a', ''), day('b', '2027-03-04'), day('c', '')] }), { start: '2027-03-03', end: '2027-03-05' });
});

test('trips are limited to 60 days', () => {
  const p = planDates(trip(), { start: '2027-03-03', end: '2028-03-03' }, 'end');
  assert.equal(p.days.length, 60);
  assert.deepEqual([p.clamped, p.end], [true, '2027-05-01']);
  assert.match(describePlan(p), /limited to 60 days/);
});

test('nothing to do when the range is unchanged, and an empty field on a dated trip is ignored', () => {
  assert.equal(planDates(trip(), { start: '2027-03-03', end: '2027-03-05' }, 'start').changed, false);
  assert.equal(planDates(trip(), { start: '', end: '' }, 'start'), null);
});

test('days out of order are put in date order and duplicates on one date are kept', () => {
  const t = { id: 't', days: [day('c', '2027-03-05'), day('a', '2027-03-03'), day('a2', '2027-03-03')] };
  const p = planDates(t, { start: '2027-03-03', end: '2027-03-05' }, 'end');
  assert.deepEqual(dates(p), ['2027-03-03', '2027-03-03', '2027-03-04', '2027-03-05']);
  assert.deepEqual([ids(p)[0], ids(p)[1], ids(p)[3]], ['a', 'a2', 'c']); // the day in between (Mar 4) is a new one
  assert.equal(p.added, 1);
});

test('describePlan', () => {
  assert.equal(describePlan({ added: 2, droppedDays: 0 }), 'Added 2 days.');
  assert.equal(describePlan({ added: 1, droppedDays: 0, shifted: false }), 'Added 1 day.');
  assert.equal(describePlan({ shifted: true, added: 0, droppedDays: 0 }), 'Moved the whole trip.');
  assert.equal(describePlan({ added: 0, droppedDays: 3 }), 'Removed 3 days.');
});

test('the reducer applies the plan, bumps updatedAt, and leaves other trips alone', () => {
  const other = { id: 'o', days: [day('x', '2027-01-01')], updatedAt: 0 };
  const before = [{ ...trip(), updatedAt: 0 }, other];
  const after = tripsReducer(before, { type: 'trip/setDates', tripId: 't', start: '2027-03-03', end: '2027-03-06', edited: 'end' });
  assert.equal(after[0].days.length, 4);
  assert.ok(after[0].updatedAt > 0);
  assert.equal(after[1], other);
  assert.equal(before[0].days.length, 3); // input not mutated
  const same = tripsReducer(before, { type: 'trip/setDates', tripId: 't', start: '2027-03-03', end: '2027-03-05', edited: 'end' });
  assert.equal(same[0], before[0]); // no change, no new object, no needless save
});
