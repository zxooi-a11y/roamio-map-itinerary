import { daysBetween } from '../dates.js';
import { guessCategory } from '../categories.js';
import { newId } from '../ids.js';
import { MAX_TRIP_DAYS, makeTrip } from '../trips.js';

export const UNPLACED_NOTE = 'Location not found. Drag the pin to place it.';

/**
 * Decide the trip's date range and which day (0-based) each place goes on.
 *
 *  - a place with a date goes on that date; the range grows to include every date in the file
 *  - a place with a day number goes on that day of the trip
 *  - a place with neither goes on day 1
 */
export function planDays(places, { start = '', end = '' } = {}) {
  const dates = places.map((p) => p.day?.date).filter(Boolean).sort();
  if (dates.length) {
    if (!start || dates[0] < start) start = dates[0];
    if (!end || dates[dates.length - 1] > end) end = dates[dates.length - 1];
  }
  const clamp = (i) => Math.max(0, Math.min(MAX_TRIP_DAYS - 1, i));
  const dayIndexes = places.map((p) => {
    if (p.day?.date) return clamp(daysBetween(start, p.day.date));
    if (p.day?.n) return clamp(p.day.n - 1);
    return 0;
  });
  const minDays = Math.max(1, ...dayIndexes.map((i) => i + 1));
  return { start, end, dayIndexes, minDays };
}

/**
 * Build a trip from imported places. Places must already be resolved (see resolve.js):
 * those without coordinates (`lat === null`) are put at `fallback` (the trip's destination) so they
 * can be dragged into place, and are flagged with a note. If there's no fallback they are skipped.
 *
 * Returns { trip, placed, unplaced, skipped }.
 */
export function buildImportedTrip({ title, place = '', center = null, start = '', end = '', places }) {
  const plan = planDays(places, { start, end });
  const trip = makeTrip({ title, place, center, start: plan.start, end: plan.end, minDays: plan.minDays });

  const located = places.filter((p) => p.lat !== null);
  const fallback = center || (located.length ? { lat: avg(located.map((p) => p.lat)), lng: avg(located.map((p) => p.lng)) } : null);
  let unplaced = 0, skipped = 0;

  places.forEach((p, i) => {
    const hasCoords = p.lat !== null;
    if (!hasCoords && !fallback) { skipped++; return; }
    if (!hasCoords) unplaced++;
    const spot = hasCoords ? p : fallback;
    trip.days[plan.dayIndexes[i]].stops.push({
      id: newId(),
      name: p.name,
      time: p.time || '',
      cat: p.cat || guessCategory(p.name),
      note: p.note || (hasCoords ? '' : UNPLACED_NOTE),
      lat: spot.lat,
      lng: spot.lng,
    });
  });

  return { trip, placed: places.length - unplaced - skipped, unplaced, skipped };
}

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
