import { addDays, daysBetween, plural } from './dates.js';
import { MAX_TRIP_DAYS, newDay } from './trips.js';

/*
 * Changing a trip's start / end date adds or removes days to match. Rules:
 *
 *  - Days keep their calendar date. Extending the range adds empty days for the new dates (before or after);
 *    shortening it removes the days that fall outside. Removing days that contain stops needs confirming
 *    (planDates reports how many, the caller asks).
 *  - Moving the start past the end (or the end before the start) can't be a valid range, so it SHIFTS the whole
 *    trip: same length, every day's date moves by the same amount, and nothing is lost.
 *  - A trip with no dates yet takes its dates from the day count: set one date and the other is worked out,
 *    days are numbered in order, and extra days are added (or trailing ones removed) to fit a longer/shorter range.
 *  - Trips are capped at MAX_TRIP_DAYS days.
 */

/** Each day's date: its own, or worked out from a neighbour (previous + 1, or next - 1). null if no day has a date. */
export function effectiveDates(days) {
  const out = days.map((d) => d.date || '');
  if (!out.some(Boolean)) return null;
  for (let i = 1; i < out.length; i++) if (!out[i] && out[i - 1]) out[i] = addDays(out[i - 1], 1);
  for (let i = out.length - 2; i >= 0; i--) if (!out[i] && out[i + 1]) out[i] = addDays(out[i + 1], -1);
  return out;
}

/** First and last date of the trip (counting undated days by position), or null if it has no dates. */
export function dateRange(trip) {
  const eff = effectiveDates(trip.days);
  if (!eff) return null;
  const sorted = [...eff].sort();
  return { start: sorted[0], end: sorted[sorted.length - 1] };
}

/**
 * Work out what a new date range does to a trip, without changing it.
 *
 * @param trip
 * @param {{ start?: string, end?: string }} range  the dates now in the two fields ("" for an empty field)
 * @param {'start'|'end'} edited                    which field the user just changed
 * @returns null when there's nothing to do, otherwise
 *   { start, end, days, added, droppedDays, droppedStops, shifted, clamped, changed }
 */
export function planDates(trip, range, edited) {
  let { start = '', end = '' } = range;
  const eff = effectiveDates(trip.days);
  const cur = eff ? dateRange(trip) : null;
  const length = cur ? daysBetween(cur.start, cur.end) + 1 : Math.max(1, trip.days.length);

  // Only one date known (a trip with no dates yet): keep the number of days.
  if (start && !end) end = addDays(start, length - 1);
  if (end && !start) start = addDays(end, -(length - 1));
  if (!start || !end) return null;

  // An impossible range on a dated trip means "move the whole trip".
  let shifted = false;
  if (start > end) {
    if (edited === 'end') start = addDays(end, -(length - 1));
    else end = addDays(start, length - 1);
    shifted = Boolean(cur);
  }

  let clamped = false;
  if (daysBetween(start, end) + 1 > MAX_TRIP_DAYS) {
    end = addDays(start, MAX_TRIP_DAYS - 1);
    clamped = true;
  }
  const count = daysBetween(start, end) + 1;

  let days, dropped = [];
  if (!cur) {
    days = trip.days.slice(0, count).map((d, i) => ({ ...d, date: addDays(start, i) }));
    dropped = trip.days.slice(count);
    for (let i = days.length; i < count; i++) days.push(newDay(addDays(start, i)));
  } else if (shifted) {
    const delta = edited === 'end' ? daysBetween(cur.end, end) : daysBetween(cur.start, start);
    days = trip.days.map((d, i) => ({ ...d, date: addDays(eff[i], delta) }));
  } else {
    const kept = [];
    trip.days.forEach((d, i) => {
      if (eff[i] >= start && eff[i] <= end) kept.push(d.date === eff[i] ? d : { ...d, date: eff[i] });
      else dropped.push(d);
    });
    const have = new Set(kept.map((d) => d.date));
    for (let i = 0; i < count; i++) {
      const date = addDays(start, i);
      if (!have.has(date)) kept.push(newDay(date));
    }
    days = kept.sort((a, b) => a.date.localeCompare(b.date)); // stable: days on the same date keep their order
  }

  const oldIds = new Set(trip.days.map((d) => d.id));
  const added = days.filter((d) => !oldIds.has(d.id)).length;
  const droppedStops = dropped.reduce((n, d) => n + d.stops.length, 0);
  const changed = added > 0 || dropped.length > 0 || days.some((d, i) => d !== trip.days[i]);
  return { start, end, days, added, droppedDays: dropped.length, droppedStops, shifted, clamped, changed };
}

/** A short sentence for a toast, e.g. "Added 2 days." */
export function describePlan(plan) {
  const parts = [];
  if (plan.shifted) parts.push('Moved the whole trip');
  if (plan.added) parts.push(`Added ${plural(plan.added, 'day')}`);
  if (plan.droppedDays) parts.push(`Removed ${plural(plan.droppedDays, 'day')}`);
  if (plan.clamped) parts.push(`Trips are limited to ${MAX_TRIP_DAYS} days`);
  return parts.length ? parts.join('. ') + '.' : '';
}
