import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, fmtRange, plural } from './dates.js';
import { guessCategory, categoryOf } from './categories.js';
import { MAX_TRIP_DAYS, badgeText, liveDayIndex, makeTrip, nextTrip, normalizeStore, sortTrips, tripPhase, tripRange } from './trips.js';
import { decodePolyline6, formatDistance, formatDuration, routeKey, routeSummary } from './routing.js';
import { parseResult } from './geocode.js';

const TODAY = '2026-06-15';
const trip = (dates, extra = {}) => ({ id: dates.join(), title: 'T', updatedAt: 0, days: dates.map((date, i) => ({ id: 'd' + i, date, stops: [] })), ...extra });

test('dates', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // across a DST change in many zones
  assert.equal(plural(1, 'day'), '1 day');
  assert.equal(plural(3, 'stop'), '3 stops');
  assert.match(fmtRange('2026-12-30', '2027-01-02'), /2026.*2027/);
});

test('makeTrip creates one day per date, capped', () => {
  const t = makeTrip({ title: 'X', start: '2026-07-01', end: '2026-07-03' });
  assert.deepEqual(t.days.map((d) => d.date), ['2026-07-01', '2026-07-02', '2026-07-03']);
  assert.equal(makeTrip({ title: 'X', start: '2026-01-01', end: '2026-12-31' }).days.length, MAX_TRIP_DAYS);
  const undated = makeTrip({ title: 'X' });
  assert.equal(undated.days.length, 1);
  assert.equal(undated.days[0].date, '');
});

test('trip phase and badge', () => {
  assert.equal(tripPhase(trip(['']), TODAY), 'planning');
  assert.equal(tripPhase(trip(['2026-06-01', '2026-06-10']), TODAY), 'past');
  assert.equal(tripPhase(trip(['2026-06-14', '2026-06-16']), TODAY), 'live');
  assert.equal(tripPhase(trip(['2026-06-20']), TODAY), 'upcoming');
  assert.equal(badgeText(trip(['2026-06-16']), TODAY), 'Tomorrow');
  assert.equal(badgeText(trip(['2026-06-20']), TODAY), 'In 5 days');
  assert.deepEqual(tripRange(trip(['2026-06-20', '', '2026-06-18'])), { start: '2026-06-18', end: '2026-06-20' });
});

test('sorting and next trip', () => {
  const past = trip(['2026-01-01']), live = trip(['2026-06-15']), soon = trip(['2026-07-01']), later = trip(['2026-08-01']), plan = trip(['']);
  assert.deepEqual(sortTrips([plan, later, past, soon, live], TODAY), [live, soon, later, plan, past]);
  assert.equal(nextTrip([later, soon], TODAY), soon);
  assert.equal(nextTrip([later, live], TODAY), live);
  assert.equal(nextTrip([past, plan], TODAY), null);
});

test('liveDayIndex prefers the day dated today, else counts from the start', () => {
  assert.equal(liveDayIndex(trip(['2026-06-14', '2026-06-15', '2026-06-16']), TODAY), 1);
  assert.equal(liveDayIndex(trip(['2026-06-13', '', '2026-06-20']), TODAY), 2);
});

test('normalizeStore repairs bad data', () => {
  const { trips } = normalizeStore({ trips: [null, { days: [{ stops: [{ lat: 1, lng: 2 }, { lat: 'x' }] }, 5] }] });
  assert.equal(trips.length, 1);
  assert.equal(trips[0].days.length, 1);
  assert.equal(trips[0].days[0].mode, 'foot');
  assert.equal(trips[0].days[0].stops.length, 1);
  assert.equal(trips[0].days[0].stops[0].name, 'Untitled stop');
  assert.deepEqual(normalizeStore(null), { trips: [] });
});

test('categories', () => {
  assert.equal(guessCategory('X', 'amenity', 'cafe'), 'Café');
  assert.equal(guessCategory('Torre de Belém'), 'Landmark');
  assert.equal(guessCategory('Lisbon Oriente station'), 'Transport');
  assert.equal(categoryOf({ name: 'Museu Nacional', cat: undefined }), 'Museum');
  assert.equal(categoryOf({ name: 'Museu Nacional', cat: 'Park' }), 'Park');
});

test('routing helpers', () => {
  // Example from the polyline spec, encoded at precision 6
  assert.deepEqual(decodePolyline6('_izlhA~rlgdF_{geC~ywl@_kwzCn`{nI'), [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
  assert.equal(formatDistance(850), '850 m');
  assert.equal(formatDistance(2400), '2.4 km');
  assert.equal(formatDuration(30), '1 min');
  assert.equal(formatDuration(3900), '1 h 5 min');
  assert.equal(routeKey({ stops: [{ lat: 1, lng: 2 }] }), null);
  assert.equal(routeKey({ mode: 'car', stops: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }] }), 'car|2.00000,1.00000;4.00000,3.00000');
  assert.equal(routeSummary({ status: 'ok', dist: 1200, dur: 600, approx: true }), '1.2 km · 10 min (by road)');
  assert.equal(routeSummary(undefined), '');
});

test('geocode result parsing', () => {
  const r = parseResult({ name: 'Belém Tower', display_name: 'Belém Tower, Lisbon, Portugal', lat: '38.69', lon: '-9.21', category: 'historic', type: 'tower' });
  assert.equal(r.name, 'Belém Tower');
  assert.equal(r.addr, 'Lisbon, Portugal');
  assert.equal(r.country, 'Portugal');
  assert.equal(r.cat, 'Landmark');
  assert.equal(r.lat, 38.69);
});
