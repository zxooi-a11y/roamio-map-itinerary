import { addDays, daysBetween, daysUntil, fmtRange, plural, todayStr } from './dates.js';
import { newId } from './ids.js';

/*
 * Data model (saved to localStorage as { trips: Trip[] })
 *
 * Trip  { id, title, place, center: {lat,lng}|null, photo?, photoTried?, createdAt, updatedAt, days: Day[] }
 * Day   { id, title, date: "YYYY-MM-DD"|"", mode: "foot"|"bike"|"car", collapsed?, img?: dataURL, stops: Stop[] }
 * Stop  { id, name, time: "HH:MM"|"", cat, note, lat, lng }
 */

export const MAX_TRIP_DAYS = 60;
export const TRAVEL_MODES = [
  { key: 'foot', label: 'Walking' },
  { key: 'bike', label: 'Cycling' },
  { key: 'car', label: 'Driving' },
];

export const newDay = (date = '') => ({ id: newId(), title: '', date, mode: 'foot', stops: [] });

/**
 * Build a new trip. With both dates it gets one day per date (capped), otherwise one undated day.
 * `minDays` guarantees at least that many days (extra days continue the dates, or stay undated).
 */
export function makeTrip({ title, place = '', center = null, start = '', end = '', minDays = 1 }) {
  const dated = Boolean(start && end);
  const fromDates = dated ? daysBetween(start, end) + 1 : 1;
  const count = Math.max(1, Math.min(MAX_TRIP_DAYS, Math.max(fromDates, minDays)));
  const now = Date.now();
  return {
    id: newId(), title, place, center, createdAt: now, updatedAt: now,
    days: Array.from({ length: count }, (_, i) => newDay(dated ? addDays(start, i) : '')),
  };
}

/** First and last dated day, or null if no day has a date. */
export function tripRange(trip) {
  const ds = trip.days.map((d) => d.date).filter(Boolean).sort();
  return ds.length ? { start: ds[0], end: ds[ds.length - 1] } : null;
}

/** 'planning' (no dates) | 'upcoming' | 'live' | 'past' */
export function tripPhase(trip, today = todayStr()) {
  const r = tripRange(trip);
  if (!r) return 'planning';
  if (r.end < today) return 'past';
  return r.start <= today ? 'live' : 'upcoming';
}

export const stopCount = (trip) => trip.days.reduce((n, d) => n + d.stops.length, 0);
export const tripTitle = (trip) => trip.title || 'Untitled trip';

export function badgeText(trip, today = todayStr()) {
  const phase = tripPhase(trip, today);
  if (phase === 'planning') return 'Just planning';
  if (phase === 'past') return 'Completed';
  if (phase === 'live') return 'In progress';
  const n = daysUntil(tripRange(trip).start, today);
  return n === 1 ? 'Tomorrow' : 'In ' + n + ' days';
}

export const metaText = (trip) => plural(trip.days.length, 'day') + ' · ' + plural(stopCount(trip), 'stop');

/** "Lisbon, Portugal · 4 Mar – 9 Mar 2026 · 3 days · 12 stops" */
export function summaryLine(trip, { withStops = true } = {}) {
  const r = tripRange(trip);
  const bits = [];
  if (trip.place) bits.push(trip.place);
  if (r) bits.push(fmtRange(r.start, r.end));
  bits.push(plural(trip.days.length, 'day'));
  if (withStops) bits.push(plural(stopCount(trip), 'stop'));
  return bits.join(' · ');
}

const PHASE_ORDER = { live: 0, upcoming: 1, planning: 2, past: 3 };

/** Live first, then upcoming (soonest first), then planning (recently edited first), then past (latest first). */
export function sortTrips(trips, today = todayStr()) {
  return trips
    .map((t) => ({ t, phase: tripPhase(t, today), range: tripRange(t) }))
    .sort((a, b) => {
      if (a.phase !== b.phase) return PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase];
      if (a.phase === 'past') return b.range.end.localeCompare(a.range.end);
      if (a.range && b.range) return a.range.start.localeCompare(b.range.start);
      return (b.t.updatedAt || 0) - (a.t.updatedAt || 0);
    })
    .map((x) => x.t);
}

/** The trip to feature on the home page: one in progress, else the next upcoming one. */
export function nextTrip(trips, today = todayStr()) {
  const byStart = (a, b) => tripRange(a).start.localeCompare(tripRange(b).start);
  const of = (phase) => trips.filter((t) => tripPhase(t, today) === phase).sort(byStart)[0];
  return of('live') || of('upcoming') || null;
}

/** Index of "today" within a live trip: the day dated today, else counted from the start date. */
export function liveDayIndex(trip, today = todayStr()) {
  const exact = trip.days.findIndex((d) => d.date === today);
  if (exact >= 0) return exact;
  const r = tripRange(trip);
  const fromStart = r ? daysBetween(r.start, today) : 0;
  return Math.max(0, Math.min(trip.days.length - 1, fromStart));
}

/** Repair anything missing or malformed in saved data so the UI can trust its shape. */
export function normalizeStore(raw) {
  const trips = (raw && Array.isArray(raw.trips) ? raw.trips : [])
    .filter((t) => t && typeof t === 'object')
    .map((t) => ({
      ...t,
      id: t.id || newId(),
      title: t.title || '',
      place: t.place || '',
      center: t.center && isFinite(t.center.lat) && isFinite(t.center.lng) ? t.center : null,
      days: (Array.isArray(t.days) ? t.days : [])
        .filter((d) => d && typeof d === 'object')
        .map((d) => ({
          ...d,
          id: d.id || newId(),
          title: d.title || '',
          date: d.date || '',
          mode: TRAVEL_MODES.some((m) => m.key === d.mode) ? d.mode : 'foot',
          stops: (Array.isArray(d.stops) ? d.stops : [])
            .filter((s) => s && isFinite(s.lat) && isFinite(s.lng))
            .map((s) => ({ ...s, id: s.id || newId(), name: s.name || 'Untitled stop', time: s.time || '', note: s.note || '' })),
        })),
    }));
  return { trips };
}
