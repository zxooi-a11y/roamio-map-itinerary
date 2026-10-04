import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellToValue } from './readFile.js';
import { parseCategory, parseCsv, parseCsvPlaces, parseDay, parseMarkdownPlaces, parseTime, rowsToPlaces } from './parse.js';
import { buildImportedTrip, planDays, UNPLACED_NOTE } from './buildTrip.js';
import { queriesFor, resolvePlaces } from './resolve.js';

test('parseDay', () => {
  assert.deepEqual(parseDay('3'), { n: 3 });
  assert.deepEqual(parseDay('Day 2'), { n: 2 });
  assert.deepEqual(parseDay(4), { n: 4 });
  assert.deepEqual(parseDay('2026-07-02'), { date: '2026-07-02' });
  assert.deepEqual(parseDay('2026/7/2'), { date: '2026-07-02' });
  assert.deepEqual(parseDay('2 Jul 2026'), { date: '2026-07-02' });
  assert.equal(parseDay('2026-02-31'), null);
  assert.equal(parseDay('0'), null);
  assert.equal(parseDay('soon'), null);
  assert.equal(parseDay(''), null);
});

test('parseTime', () => {
  assert.equal(parseTime('9:00'), '09:00');
  assert.equal(parseTime('21:30'), '21:30');
  assert.equal(parseTime('9am'), '09:00');
  assert.equal(parseTime('12:15 AM'), '00:15');
  assert.equal(parseTime('7:05 pm'), '19:05');
  assert.equal(parseTime('09:00:00'), '09:00');
  assert.equal(parseTime('25:00'), '');
  assert.equal(parseTime('lunch'), '');
});

test('parseCategory', () => {
  assert.equal(parseCategory('restaurant'), 'Restaurant');
  assert.equal(parseCategory('Cafe'), 'Café');
  assert.equal(parseCategory('Museums'), 'Museum');
  assert.equal(parseCategory('???'), '');
});

test('parseCsv handles quotes, newlines in cells, BOM, semicolons and tabs', () => {
  assert.deepEqual(parseCsv('﻿a,b\n"x, y","say ""hi"""\r\n"multi\nline",z'), [['a', 'b'], ['x, y', 'say "hi"'], ['multi\nline', 'z']]);
  assert.deepEqual(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]); // trailing newline adds no row
});

test('CSV with headers in any order, with aliases', () => {
  const places = parseCsvPlaces([
    'Time,Place,Day,Type,Latitude,Longitude,Notes',
    '09:00,Belém Tower,1,landmark,38.6916,-9.2160,Book ahead',
    '13:00,"Time Out Market, Lisbon",Day 2,Food,,,',
  ].join('\n'));
  assert.equal(places.length, 2);
  assert.deepEqual(places[0], { name: 'Belém Tower', addr: '', lat: 38.6916, lng: -9.216, day: { n: 1 }, time: '09:00', cat: 'Landmark', note: 'Book ahead' });
  assert.equal(places[1].name, 'Time Out Market, Lisbon');
  assert.equal(places[1].lat, null);
  assert.deepEqual(places[1].day, { n: 2 });
  assert.equal(places[1].cat, 'Restaurant');
});

test('CSV without a header row: first column is the name', () => {
  const places = parseCsvPlaces('Belém Tower\nAlfama\n\nSé de Lisboa');
  assert.deepEqual(places.map((p) => p.name), ['Belém Tower', 'Alfama', 'Sé de Lisboa']);
});

test('coordinates must be both valid, otherwise they are ignored', () => {
  const [a, b, c] = rowsToPlaces([['name', 'lat', 'lng'], ['A', 38.7, ''], ['B', 200, 10], ['C', '38,7', '-9,1']]);
  assert.equal(a.lat, null);
  assert.equal(b.lat, null);
  assert.deepEqual([c.lat, c.lng], [38.7, -9.1]); // decimal comma accepted
});

test('rows without a name are named after their address or coordinates', () => {
  const [p] = rowsToPlaces([['address'], ['Rua Augusta 10, Lisbon']]);
  assert.equal(p.name, 'Rua Augusta 10, Lisbon');
  assert.equal(p.addr, 'Rua Augusta 10, Lisbon');
  const [q] = rowsToPlaces([['lat', 'lng'], [38.7139, -9.1394]]);
  assert.equal(q.name, '38.7139, -9.1394');
});

test('spreadsheet cells can be numbers, including day-fractions for times', () => {
  const [p] = rowsToPlaces([['Name', 'Day', 'Time', 'Lat', 'Lng'], ['Castle', 2, 0.4375, 38.71, -9.13]]);
  assert.deepEqual(p.day, { n: 2 });
  assert.equal(p.time, '10:30');
  assert.equal(p.lat, 38.71);
});

test('cellToValue turns spreadsheet Dates into time-zone-proof text', () => {
  // The reader gives Dates whose UTC fields hold the wall-clock value
  assert.equal(cellToValue(new Date(Date.UTC(2026, 6, 3))), '2026-07-03');
  assert.equal(cellToValue(new Date(Date.UTC(1899, 11, 30, 13, 59, 59, 999))), '14:00'); // float noise rounded
  assert.equal(cellToValue(new Date(Date.UTC(1899, 11, 30, 9, 5))), '09:05');
  assert.equal(cellToValue(new Date(Date.UTC(2026, 6, 3, 23, 59, 59, 999))), '2026-07-04'); // rounds to the next minute/day
  assert.equal(cellToValue(new Date(Date.UTC(2026, 6, 3, 14, 0))), '2026-07-03 14:00'); // date + time keeps both
  assert.equal(parseTime('2026-07-03 14:00'), '14:00');
  assert.deepEqual(parseDay('2026-07-03 14:00'), { date: '2026-07-03' });
  assert.equal(cellToValue('hello'), 'hello');
  assert.equal(cellToValue(5), 5);
  assert.deepEqual(rowsToPlaces([['Name', 'Day', 'Time'], ['X', cellToValue(new Date(Date.UTC(2026, 6, 3))), cellToValue(new Date(Date.UTC(1899, 11, 30, 8, 30)))]])[0].day, { date: '2026-07-03' });
});

test('markdown lists, with day headings, times and notes', () => {
  const md = `# My Lisbon trip

Some intro text that is ignored.

## Day 1 – Belém
- 09:00 **Belém Tower** – book ahead
- [Pastéis de Belém](https://example.com) - get 6
- [ ] Jerónimos Monastery

## Day 2
1. 10am Alfama
2. Sé de Lisboa
`;
  const places = parseMarkdownPlaces(md);
  assert.deepEqual(places.map((p) => [p.name, p.day?.n, p.time, p.note]), [
    ['Belém Tower', 1, '09:00', 'book ahead'],
    ['Pastéis de Belém', 1, '', 'get 6'],
    ['Jerónimos Monastery', 1, '', ''],
    ['Alfama', 2, '10:00', ''],
    ['Sé de Lisboa', 2, '', ''],
  ]);
});

test('markdown: hyphens inside names are kept; date headings work', () => {
  const places = parseMarkdownPlaces('## 2026-07-02\n- Saint-Germain-des-Prés\n- Café de Flore - lunch');
  assert.equal(places[0].name, 'Saint-Germain-des-Prés');
  assert.deepEqual(places[0].day, { date: '2026-07-02' });
  assert.equal(places[1].name, 'Café de Flore');
  assert.equal(places[1].note, 'lunch');
});

test('markdown tables use the same columns as CSV, and inherit the day heading', () => {
  const md = `## Day 3

| Time | Place | Notes |
| ---- | ----- | ----- |
| 9:00 | Castle | uphill \\| steep |
| 12:00 | **Lunch spot** | |
`;
  const places = parseMarkdownPlaces(md);
  assert.equal(places.length, 2);
  assert.deepEqual(places.map((p) => [p.name, p.time, p.day?.n]), [['Castle', '09:00', 3], ['Lunch spot', '12:00', 3]]);
  assert.equal(places[0].note, 'uphill | steep');
});

const P = (name, extra = {}) => ({ name, addr: '', lat: null, lng: null, day: null, time: '', cat: '', note: '', ...extra });

test('planDays: dates extend the trip range and decide the day', () => {
  const plan = planDays([P('a', { day: { date: '2026-07-03' } }), P('b', { day: { date: '2026-07-01' } }), P('c')]);
  assert.equal(plan.start, '2026-07-01');
  assert.equal(plan.end, '2026-07-03');
  assert.deepEqual(plan.dayIndexes, [2, 0, 0]);
  assert.equal(plan.minDays, 3);
});

test('planDays: day numbers, and the typed trip dates win when they cover the file', () => {
  const plan = planDays([P('a', { day: { n: 4 } }), P('b', { day: { date: '2026-07-02' } })], { start: '2026-07-01', end: '2026-07-05' });
  assert.deepEqual([plan.start, plan.end], ['2026-07-01', '2026-07-05']);
  assert.deepEqual(plan.dayIndexes, [3, 1]);
});

test('planDays: absurd day numbers are capped', () => {
  assert.equal(planDays([P('a', { day: { n: 999 } })]).minDays, 60);
});

test('buildImportedTrip puts stops on their days, with fallback for unlocated ones', () => {
  const places = [
    P('Tower', { lat: 38.69, lng: -9.21, day: { n: 1 }, time: '09:00', cat: 'Landmark' }),
    P('Mystery cafe', { day: { n: 2 } }),
    P('Alfama', { lat: 38.71, lng: -9.13, day: { n: 2 }, note: 'walk' }),
  ];
  const { trip, placed, unplaced, skipped } = buildImportedTrip({ title: 'Lisbon', places });
  assert.deepEqual([placed, unplaced, skipped], [2, 1, 0]);
  assert.equal(trip.days.length, 2);
  assert.deepEqual(trip.days[0].stops.map((s) => s.name), ['Tower']);
  assert.deepEqual(trip.days[1].stops.map((s) => s.name), ['Mystery cafe', 'Alfama']);
  const mystery = trip.days[1].stops[0];
  assert.equal(mystery.note, UNPLACED_NOTE);
  assert.ok(Math.abs(mystery.lat - 38.7) < 0.011); // placed at the centre of the located stops
  assert.equal(trip.days[0].stops[0].cat, 'Landmark');
  assert.ok(trip.days.every((d) => d.stops.every((s) => s.id && isFinite(s.lat))));
});

test('buildImportedTrip: unlocated stops use the destination, or are skipped when there is nothing to use', () => {
  const withCenter = buildImportedTrip({ title: 'T', center: { lat: 1, lng: 2 }, places: [P('x')] });
  assert.deepEqual([withCenter.trip.days[0].stops[0].lat, withCenter.unplaced], [1, 1]);
  const none = buildImportedTrip({ title: 'T', places: [P('x')] });
  assert.deepEqual([none.skipped, none.trip.days[0].stops.length], [1, 0]);
});

test('queriesFor adds the destination for disambiguation, without duplicating it', () => {
  assert.deepEqual(queriesFor(P('Castle'), 'Lisbon, Portugal'), ['Castle, Lisbon, Portugal', 'Castle']);
  assert.deepEqual(queriesFor(P('Castle', { addr: 'Rua 1, Lisbon' }), 'Lisbon, Portugal'), ['Castle, Rua 1, Lisbon', 'Rua 1, Lisbon']);
  assert.deepEqual(queriesFor(P('Castle'), ''), ['Castle']);
});

test('resolvePlaces looks up only places without coordinates, reports progress and falls back to the next query', async () => {
  const calls = [];
  const search = async (q) => { calls.push(q); return q === 'Alfama, Lisbon' ? [{ lat: 38.7, lng: -9.1, cat: 'Landmark' }] : []; };
  const progress = [];
  const out = await resolvePlaces(
    [P('Tower', { lat: 1, lng: 2 }), P('Alfama'), P('Nowhere')],
    { context: 'Lisbon', search, onProgress: (d, t) => progress.push([d, t]) },
  );
  assert.deepEqual(out.map((p) => p.found), [true, true, false]);
  assert.deepEqual([out[1].lat, out[1].cat], [38.7, 'Landmark']);
  assert.deepEqual(calls, ['Alfama, Lisbon', 'Nowhere, Lisbon', 'Nowhere']); // Alfama found on the first try
  assert.deepEqual(progress, [[1, 2], [2, 2]]);
}, { timeout: 15000 });

test('resolvePlaces stops when aborted', async () => {
  const ctl = new AbortController();
  const out = await resolvePlaces([P('a'), P('b')], { signal: ctl.signal, search: async () => { ctl.abort(); return []; } });
  assert.ok(out.length < 2);
});
