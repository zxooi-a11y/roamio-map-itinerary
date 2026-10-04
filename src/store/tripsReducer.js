import { addDays } from '../lib/dates.js';
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

    case 'stop/add': // { stop }
      return updateTrip(trips, tripId, (t) => touch(updateDay(t, dayId, (d) => ({ ...d, stops: [...d.stops, action.stop] }))));

    case 'stop/update': // { patch }
      return updateTrip(trips, tripId, (t) =>
        touch({ ...t, days: t.days.map((d) => ({ ...d, stops: d.stops.map((s) => (s.id === stopId ? { ...s, ...action.patch } : s)) })) }));

    case 'stop/remove':
      return updateTrip(trips, tripId, (t) =>
        touch(updateDay(t, dayId, (d) => ({ ...d, stops: d.stops.filter((s) => s.id !== stopId) }))));

    case 'stop/move': // { toDayId, toIndex } index among the target day's stops *without* the moved stop
      return updateTrip(trips, tripId, (t) => {
        const stop = t.days.flatMap((d) => d.stops).find((s) => s.id === stopId);
        if (!stop) return t;
        const days = t.days.map((d) => {
          const stops = d.stops.filter((s) => s.id !== stopId);
          if (d.id === action.toDayId) stops.splice(Math.max(0, Math.min(action.toIndex, stops.length)), 0, stop);
          return stops.length === d.stops.length && d.id !== action.toDayId ? d : { ...d, stops };
        });
        return touch({ ...t, days });
      });

    default:
      throw new Error('Unknown action: ' + type);
  }
}
