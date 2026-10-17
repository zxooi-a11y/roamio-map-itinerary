// Timing of a day: how long each leg takes, and keeping the stops' times in order and achievable.
//
// A stop's `time` ("HH:MM") is when you want to be there. The leg into a stop uses `stop.travel`
// (walking / cycling / driving), falling back to the day's mode. Rules kept by retimeDay():
//   - times never run backwards: the day's timetable is handed out in order, so a stop moved first gets the earliest time
//   - a stop is never planned sooner than the previous stop's time plus the travel time between them
// Travel times come from the routing services, but never below what the distance allows at that speed
// (a free service answering with a driving time for a walk, or nothing at all, can't make London 5 minutes from Bristol).

export const toMin = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
  return m ? Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]) : null;
};
export const fromMin = (n) => {
  const c = Math.max(0, Math.min(23 * 60 + 59, Math.round(n)));
  return String(Math.floor(c / 60)).padStart(2, '0') + ':' + String(c % 60).padStart(2, '0');
};

/** Straight-line metres between two points. */
export function haversine(a, b) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Fastest believable speeds (m/s) for the straight-line floor, and typical ones (with a detour factor) for estimates.
const FLOOR_SPEED = { foot: 2.0, bike: 8, car: 27 }; // ~7 km/h, ~29 km/h, ~97 km/h (as the crow flies)
const TYPICAL = {
  foot: () => ({ speed: 1.35, detour: 1.3 }), // ~4.9 km/h
  bike: () => ({ speed: 4.2, detour: 1.3 }), // ~15 km/h
  car: (m) => ({ speed: m < 5000 ? 8 : m < 60000 ? 14 : 20, detour: 1.3 }), // ~29 / 50 / 72 km/h on the road
};

/** The least a leg can take, seconds: the straight line at the fastest speed for the mode. */
export const minSeconds = (a, b, mode) => haversine(a, b) / (FLOOR_SPEED[mode] || FLOOR_SPEED.foot);

/** A rough time for a leg with no route available, seconds. */
export function estimateSeconds(a, b, mode) {
  const m = haversine(a, b);
  const { speed, detour } = (TYPICAL[mode] || TYPICAL.foot)(m);
  return (m * detour) / speed;
}

/** Seconds for a leg: the routed time if there is one, never less than the floor; otherwise an estimate. */
export function legSeconds(a, b, mode, route) {
  const floor = minSeconds(a, b, mode);
  if (route?.status === 'ok' && route.dur > 0) return Math.max(route.dur, floor, route.approx && mode !== 'car' ? estimateSeconds(a, b, mode) : 0);
  return Math.max(estimateSeconds(a, b, mode), floor);
}

/** The mode of the leg into stop i of a day. */
export const legMode = (day, stop) => stop.travel || day.mode || 'foot';

const ceil5 = (m) => Math.ceil(m / 5) * 5;

/**
 * Hand the day's existing times out in order to the stops that have one (so reordering keeps the timetable
 * ascending: 7am can't end up after 8pm). Stops without a time stay without one.
 */
export function reassignTimes(stops) {
  const times = stops.map((s) => s.time).filter((t) => toMin(t) !== null).sort((a, b) => toMin(a) - toMin(b));
  if (!times.length) return stops;
  let k = 0, changed = false;
  const out = stops.map((s) => {
    if (toMin(s.time) === null) return s;
    const t = times[k++];
    if (t === s.time) return s;
    changed = true;
    return { ...s, time: t };
  });
  return changed ? out : stops;
}

/**
 * Push stops later where the time since the previous stop is shorter than the travel between them.
 * `seconds[i]` is the travel time from stop i-1 to stop i. Returns { stops, changed, overflow } where overflow
 * means something would have had to run past 23:59 (it is held at 23:59 and still flagged by timingIssues).
 */
export function retimeDay(stops, seconds) {
  let clock = null, changed = false, overflow = false;
  const out = stops.map((s, i) => {
    const t = toMin(s.time);
    const travel = i > 0 ? (seconds[i] || 0) / 60 : 0;
    if (t === null) { if (clock !== null) clock += travel; return s; }
    let next = t;
    if (clock !== null && t < clock + travel) {
      next = ceil5(clock + travel);
      if (next > 23 * 60 + 59) { next = 23 * 60 + 59; overflow = true; }
    }
    clock = Math.max(next, t);
    if (next === t) return s;
    changed = true;
    return { ...s, time: fromMin(next) };
  });
  return { stops: changed ? out : stops, changed, overflow };
}

/**
 * For each stop after the first: when you would arrive, given the previous stop's time and the leg time,
 * and whether the stop's own time is too soon. { [stopId]: { arrive: "HH:MM"|null, short: minutes|0 } }
 */
export function legTimings(stops, seconds) {
  const out = {};
  let clock = null;
  stops.forEach((s, i) => {
    const t = toMin(s.time);
    if (i > 0) {
      const travel = (seconds[i] || 0) / 60;
      const arrive = clock !== null ? clock + travel : null;
      out[s.id] = { arrive: arrive === null ? null : fromMin(arrive), short: arrive !== null && t !== null && t < arrive - 0.5 ? Math.ceil(arrive - t) : 0, backwards: clock !== null && t !== null && t < clock };
      if (arrive !== null) clock = t !== null ? Math.max(t, arrive) : arrive;
      else if (t !== null) clock = t;
    } else if (t !== null) clock = t;
  });
  return out;
}
