// Road / path routes between a day's stops, from free public routing services.
//
// Results are cached by (mode + coordinates), so editing a stop naturally produces a
// new key. Requests run one at a time to stay polite to the free servers. Components
// subscribe via useRoute() (src/hooks/useRoute.js) and re-render when an entry changes.

const PROVIDER_TIMEOUT_MS = 12000;
const GAP_BETWEEN_REQUESTS_MS = 300;

const lngLat = (coords) => coords.map((p) => p.lng.toFixed(6) + ',' + p.lat.toFixed(6)).join(';');

const OSRM_PROFILE = { foot: 'routed-foot', bike: 'routed-bike', car: 'routed-car' };
const VALHALLA_COSTING = { foot: 'pedestrian', bike: 'bicycle', car: 'auto' };

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/** Tried in order until one returns a usable route. */
const PROVIDERS = [
  // 1. OpenStreetMap Germany OSRM: separate walking / cycling / driving networks
  async (mode, coords, signal) => {
    const data = await getJson(`https://routing.openstreetmap.de/${OSRM_PROFILE[mode]}/route/v1/driving/${lngLat(coords)}?overview=full&geometries=geojson`, signal);
    const rt = data.routes[0];
    return { pts: rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]), dist: rt.distance, dur: rt.duration };
  },
  // 2. OpenStreetMap Valhalla
  async (mode, coords, signal) => {
    const body = { locations: coords.map((p) => ({ lat: p.lat, lon: p.lng })), costing: VALHALLA_COSTING[mode] };
    const { trip } = await getJson('https://valhalla1.openstreetmap.de/route?json=' + encodeURIComponent(JSON.stringify(body)), signal);
    const pts = trip.legs.flatMap((leg, i) => decodePolyline6(leg.shape).slice(i ? 1 : 0));
    return { pts, dist: trip.summary.length * 1000, dur: trip.summary.time };
  },
  // 3. OSRM demo server: car roads only, so walking / cycling are approximate
  async (mode, coords, signal) => {
    const data = await getJson(`https://router.project-osrm.org/route/v1/driving/${lngLat(coords)}?overview=full&geometries=geojson`, signal);
    const rt = data.routes[0];
    return { pts: rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]), dist: rt.distance, dur: rt.duration, approx: mode !== 'car' };
  },
];

/** Decode a Valhalla polyline (precision 6) into [lat, lng] pairs. */
export function decodePolyline6(str) {
  let i = 0, lat = 0, lng = 0;
  const out = [];
  const next = () => {
    let b, shift = 0, res = 0;
    do { b = str.charCodeAt(i++) - 63; res |= (b & 31) << shift; shift += 5; } while (b >= 32);
    return res & 1 ? ~(res >> 1) : res >> 1;
  };
  while (i < str.length) {
    lat += next();
    lng += next();
    out.push([lat / 1e6, lng / 1e6]);
  }
  return out;
}

/* ---------- Cache + subscription ---------- */

/** key -> { status: 'loading' } | { status: 'ok', pts, dist, dur, approx? } | { status: 'fail' } */
const cache = new Map();
const listeners = new Set();
let queue = Promise.resolve();
let version = 0;

const emit = () => { version++; listeners.forEach((fn) => fn()); };

/** Changes whenever any cache entry changes (a cheap snapshot for useSyncExternalStore). */
export const getRoutesVersion = () => version;

export function subscribeRoutes(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const routeKey = (day) =>
  day.stops.length < 2 ? null : (day.mode || 'foot') + '|' + day.stops.map((s) => s.lng.toFixed(5) + ',' + s.lat.toFixed(5)).join(';');

export const getRoute = (key) => (key ? cache.get(key) : undefined);

/** Start fetching a day's route unless it's already cached / in flight. Safe to call on every render. */
export function requestRoute(day) {
  const key = routeKey(day);
  if (!key || cache.has(key)) return;
  const mode = day.mode || 'foot';
  const coords = day.stops.map((s) => ({ lat: s.lat, lng: s.lng }));
  cache.set(key, { status: 'loading' });
  emit();

  queue = queue.then(async () => {
    let result = null;
    for (const provider of PROVIDERS) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), PROVIDER_TIMEOUT_MS);
      try {
        const r = await provider(mode, coords, ctl.signal);
        if (r && r.pts && r.pts.length > 1) { result = r; break; }
      } catch {
        /* try the next service */
      } finally {
        clearTimeout(timer);
      }
    }
    cache.set(key, result ? { status: 'ok', ...result } : { status: 'fail' });
    emit();
    await new Promise((r) => setTimeout(r, GAP_BETWEEN_REQUESTS_MS));
  });
}

/** Forget a failed route and try again. */
export function retryRoute(day) {
  const key = routeKey(day);
  if (getRoute(key)?.status !== 'fail') return;
  cache.delete(key);
  requestRoute(day);
  emit();
}

/** "2.4 km · 31 min", "Finding route…", etc. Empty for days with fewer than two stops. */
export function routeSummary(route) {
  if (!route) return '';
  if (route.status === 'loading') return 'Finding route…';
  if (route.status === 'fail') return 'Route unavailable. Tap to retry';
  return formatDistance(route.dist) + ' · ' + formatDuration(route.dur) + (route.approx ? ' (by road)' : '');
}

export const formatDistance = (m) => (m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km');

export function formatDuration(sec) {
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return min + ' min';
  return Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : '');
}
