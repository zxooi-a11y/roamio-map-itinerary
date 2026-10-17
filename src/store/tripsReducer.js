import { addDays } from '../lib/dates.js';
import { dateRange, effectiveDates, planDates } from '../lib/tripDates.js';
import { autoTimes, reassignTimes } from '../lib/timing.js';
import { newDay } from '../lib/trips.js';

/*
 * Every change to trip data goes through this reducer, so the rules live in one place:
 *  - state is never mutated (React can compare by reference)
 *  - edits to a trip's content bump its updatedAt; pure UI state (collapsed, cached photo) does not
 */

const touch = (trip) => ({ ...trip, updatedAt: Date.now() });

function updateTrip(trips, tripId, fn) {
  return trips.map((t) => (t.id === tripId ? fn(t) : t));
}
// A day whose order, legs or stops changed needs its times checked against the travel times once the routes are known
// (the UI does that and sends day/retime); `retime` is that to-do marker.
const needRetime = (d) => ({ ...d, retime: true });
function updateDay(trip, dayId, fn) {
  return { ...trip, days: trip.days.map((d) => (d.id === dayId ? fn(d) : d)) };
}

export function tripsReducer(trips, action) {
  const { type, tripId, dayId, stopId } = action;
  switch (type) {
    case 'trips/load': // replace everything with what was loaded from the cloud
      return action.trips;

    case 'trip/add':
      return [...trips, action.trip];

    case 'trip/remove':
      return trips.filter((t) => t.id !== tripId);

    case 'trip/update': // { patch }
      return updateTrip(trips, tripId, (t) => touch({ ...t, ...action.patch }));

    case 'trip/setPhoto': // cached hero photo; not a user edit
      return updateTrip(trips, tripId, (t) => ({ ...t, photo: action.photo || t.photo, photoTried: true }));

    case 'trip/setDates': // { start, end, edited } adds / removes / moves days to fit (rules in lib/tripDates.js)
      return updateTrip(trips, tripId, (t) => {
        const plan = planDates(t, { start: action.start, end: action.end }, action.edited);
        return plan && plan.changed ? touch({ ...t, days: plan.days }) : t;
      });

    case 'trip/importPlaces': // { start, end, items: [{ offset, stop }], titles?: { [offset]: name } } stops go on the days of start..end (extending the trip to cover them)
      return updateTrip(trips, tripId, (t) => {
        let days = t.days;
        if (action.start) {
          const cur = dateRange(t);
          const lo = cur && cur.start < action.start ? cur.start : action.start;
          const hi = cur && cur.end > action.end ? cur.end : action.end;
          const plan = planDates(t, { start: lo, end: hi }, 'start');
          if (plan?.changed) days = plan.days;
        } else {
          // an undated trip imported without dates: offsets are day numbers, adding days when the file needs more
          const need = Math.max(0, ...action.items.map((x) => x.offset + 1));
          days = [...days, ...Array.from({ length: Math.max(0, need - days.length) }, () => newDay())];
        }
        const dates = action.start ? effectiveDates(days) : null;
        const dayOf = (offset) => {
          const idx = dates ? dates.indexOf(addDays(action.start, offset)) : offset;
          return idx < 0 ? days.length - 1 : idx;
        };
        const byDay = new Map();
        for (const { offset, stop } of action.items) byDay.set(dayOf(offset), [...(byDay.get(dayOf(offset)) || []), stop]);
        const titles = new Map(Object.entries(action.titles || {}).filter(([, v]) => v && v.trim()).map(([k, v]) => [dayOf(+k), v.trim()]));
        return touch({ ...t, days: days.map((d, i) => {
          let out = d;
          if (titles.has(i)) out = { ...out, title: titles.get(i) };
          if (byDay.has(i)) out = needRetime({ ...out, stops: [...out.stops, ...byDay.get(i)] });
          return out;
        }) });
      });

    case 'day/add':
      return updateTrip(trips, tripId, (t) => {
        const last = t.days[t.days.length - 1];
        return touch({ ...t, days: [...t.days, newDay(last?.date ? addDays(last.date, 1) : '')] });
      });

    case 'day/remove':
      return updateTrip(trips, tripId, (t) => touch({ ...t, days: t.days.filter((d) => d.id !== dayId) }));

    case 'day/update': // { patch }
      return updateTrip(trips, tripId, (t) => touch(updateDay(t, dayId, (d) => ({ ...d, ...action.patch }))));

    case 'day/setCollapsed': // UI state only
      return updateTrip(trips, tripId, (t) => updateDay(t, dayId, (d) => ({ ...d, collapsed: action.collapsed })));

    case 'day/setMode': // { mode } every leg of the day uses this mode
      return updateTrip(trips, tripId, (t) => touch(updateDay(t, dayId, (d) => needRetime({
        ...d, mode: action.mode, stops: d.stops.map(({ travel, ...s }) => s) }))));

    case 'stop/setTravel': // { mode } how to get to this stop from the one before
      return updateTrip(trips, tripId, (t) => touch({ ...t, days: t.days.map((d) =>
        (d.stops.some((s) => s.id === stopId) ? needRetime({ ...d, stops: d.stops.map((s) => (s.id === stopId ? { ...s, travel: action.mode } : s)) }) : d)) }));

    case 'day/retime': // { seconds } travel time into each stop: every stop's time follows from the one before
      return updateTrip(trips, tripId, (t) => updateDay(t, dayId, (d) => {
        const { retime, ...rest } = d;
        const r = autoTimes(d.stops, action.seconds || []);
        return r.changed ? { ...rest, stops: r.stops } : rest;
      }));

    case 'stop/add': // { stop }
      return updateTrip(trips, tripId, (t) => touch(updateDay(t, dayId, (d) => needRetime({ ...d, stops: [...d.stops, action.stop] }))));

    case 'stop/update': // { patch }
      return updateTrip(trips, tripId, (t) =>
        touch({ ...t, days: t.days.map((d) => ({ ...d, stops: d.stops.map((s) => (s.id === stopId ? { ...s, ...action.patch } : s)) })) }));

    case 'stop/remove':
      return updateTrip(trips, tripId, (t) =>
        touch(updateDay(t, dayId, (d) => needRetime({ ...d, stops: d.stops.filter((s) => s.id !== stopId) }))));

    case 'stop/move': // { toDayId, toIndex } index among the target day's stops *without* the moved stop
      return updateTrip(trips, tripId, (t) => {
        const stop = t.days.flatMap((d) => d.stops).find((s) => s.id === stopId);
        if (!stop) return t;
        const days = t.days.map((d) => {
          const stops = d.stops.filter((s) => s.id !== stopId);
          if (d.id === action.toDayId) stops.splice(Math.max(0, Math.min(action.toIndex, stops.length)), 0, stop);
          if (stops.length === d.stops.length && d.id !== action.toDayId) return d;
          // the day's timetable stays in order: times are handed out again in the new order
          return needRetime({ ...d, stops: d.id === action.toDayId ? reassignTimes(stops) : stops });
        });
        return touch({ ...t, days });
      });

    default:
      throw new Error('Unknown action: ' + type);
  }
}
