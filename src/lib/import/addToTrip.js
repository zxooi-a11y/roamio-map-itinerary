import { daysBetween } from '../dates.js';
import { guessCategory } from '../categories.js';
import { newId } from '../ids.js';
import { MAX_TRIP_DAYS } from '../trips.js';
import { UNPLACED_NOTE } from './buildTrip.js';

/**
 * Which day of the range (0 = the first date) each imported place goes on.
 *  - a place with a date in the file goes on that date (clamped into the range)
 *  - a place with a day number goes on that day of the range
 *  - the rest are spread evenly over the days in the order of the file (12 places over 4 days = 3 a day)
 * `span` is the number of days in the range.
 */
export function assignOffsets(places, { start = '', span }) {
  const cap = (i) => Math.max(0, Math.min(span - 1, i));
  const offsets = places.map((p) => {
    if (p.day?.date && start) return cap(daysBetween(start, p.day.date));
    if (p.day?.n) return cap(p.day.n - 1);
    return null;
  });
  const free = offsets.map((o, i) => (o === null ? i : -1)).filter((i) => i >= 0);
  free.forEach((i, k) => { offsets[i] = cap(Math.floor((k * span) / free.length)); });
  return offsets;
}

/**
 * The stops to add for resolved places (see resolve.js): [{ offset, stop }]. Places with no coordinates go at
 * `fallback` (the trip's destination) with a note, or are skipped when there is none.
 */
export function buildStops(places, { start = '', span, fallback = null }) {
  const offsets = assignOffsets(places, { start, span });
  const located = places.filter((p) => p.lat !== null);
  const spare = fallback || (located.length ? { lat: avg(located.map((p) => p.lat)), lng: avg(located.map((p) => p.lng)) } : null);
  const items = [];
  let unplaced = 0, skipped = 0;
  places.forEach((p, i) => {
    const hasCoords = p.lat !== null;
    if (!hasCoords && !spare) { skipped++; return; }
    if (!hasCoords) unplaced++;
    const spot = hasCoords ? p : spare;
    items.push({
      offset: offsets[i],
      stop: {
        id: newId(), name: p.name, time: p.time || '', ...(p.time ? { pin: true } : {}),
        cat: p.cat || guessCategory(p.name), note: p.note || (hasCoords ? '' : UNPLACED_NOTE), lat: spot.lat, lng: spot.lng,
      },
    });
  });
  return { items, placed: items.length - unplaced, unplaced, skipped };
}

/** How many days a range covers (at least 1, at most a trip's limit). */
export const rangeSpan = (start, end) => Math.max(1, Math.min(MAX_TRIP_DAYS, daysBetween(start, end) + 1));

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
