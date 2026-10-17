// Timing of a day: how long each leg takes, and times that follow the travel.
//
// The first stop's `time` ("HH:MM") is when the day starts. Every later stop's time follows from the one before:
// its time plus the travel time of the leg between them (the leg uses `stop.travel`: walking / public transport /
// driving, falling back to the day's mode). A stop whose time was typed (`pin`) keeps it unless it is too soon.
// Rules kept by autoTimes():
//   - times never run backwards: on a reorder the day's timetable is handed out in order, so the first stop keeps the start
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
const FLOOR_SPEED = { foot: 2.0, bike: 8, transit: 45, train: 60, car: 27 }; // ~7 km/h, ~29 km/h, ~97 km/h (as the crow flies)
const TYPICAL = {
  foot: () => ({ speed: 1.35, detour: 1.3 }), // ~4.9 km/h
  bike: () => ({ speed: 4.2, detour: 1.3 }), // ~15 km/h
  car: (m) => ({ speed: m < 5000 ? 8 : m < 60000 ? 14 : 20, detour: 1.3 }), // ~29 / 50 / 72 km/h on the road
  train: (m) => ({ speed: m < 40000 ? 14 : m < 120000 ? 24 : 32, detour: 1.25, wait: 900 }), // ~50 / 86 / 115 km/h along the line; ~15 min to get to and board
  transit: (m) => ({ speed: m < 10000 ? 7 : m < 100000 ? 14 : 25, detour: 1.3, wait: 600 }), // bus / tube, then trains; plus ~10 min of waiting
};

/** The least a leg can take, seconds: the straight line at the fastest speed for the mode. */
export const minSeconds = (a, b, mode) => haversine(a, b) / (FLOOR_SPEED[mode] || FLOOR_SPEED.foot);

/** A rough time for a leg with no route available, seconds. */
export function estimateSeconds(a, b, mode) {
  const m = haversine(a, b);
  const { speed, detour, wait = 0 } = (TYPICAL[mode] || TYPICAL.foot)(m);
  return wait + (m * detour) / speed;
}

/** Seconds for a leg: the routed time if there is one, never less than the floor; otherwise an estimate. */
export function legSeconds(a, b, mode, route) {
  const floor = minSeconds(a, b, mode);
  // trains follow no road: straight-line distance, a rail detour, boarding time and typical line speeds
  if (mode === 'train') return Math.max(estimateSeconds(a, b, 'train'), floor);
  // public transport has no routing service: its time is modelled from the road distance of the same journey
  if (mode === 'transit') {
    const crow = haversine(a, b);
    const m = route?.status === 'ok' ? Math.max(route.dist, crow) : crow * 1.3; // a road is never shorter than the straight line
    const { speed, wait } = TYPICAL.transit(m);
    return Math.max(wait + m / speed, floor);
  }
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
 * Set each stop's time from the one before: previous time + the travel time into it, rounded up to 5 minutes.
 * `seconds[i]` is the travel time from stop i-1 to stop i. The first stop's time is the start of the day; with no
 * time there, nothing is set. A stop with a typed time (`pin`) keeps it if there is enough time to get there.
 * Returns { stops, changed, overflow }; overflow means a stop would have to be after 23:59 (it is held at 23:59).
 */
export function autoTimes(stops, seconds) {
  let clock = toMin(stops[0]?.time);
  if (clock === null) return { stops, changed: false, overflow: false };
  let changed = false, overflow = false;
  const out = stops.map((s, i) => {
    if (i === 0) return s;
    const arrive = ceil5(clock + (seconds[i] || 0) / 60);
    const own = toMin(s.time);
    let next = s.pin && own !== null && own >= arrive ? own : arrive;
    if (next > 23 * 60 + 59) { next = 23 * 60 + 59; overflow = true; }
    clock = next;
    if (own === next) return s;
    changed = true;
    return { ...s, time: fromMin(next) };
  });
  return { stops: changed ? out : stops, changed, overflow };
}
