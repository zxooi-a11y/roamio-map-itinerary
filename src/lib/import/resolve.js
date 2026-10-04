import { searchPlaces } from '../geocode.js';

// Nominatim's usage policy allows at most one request per second.
const GAP_MS = 1100;
const sleep = (ms, signal) => new Promise((resolve) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
});

/** Search terms to try for a place, best first. `context` is the trip's destination, e.g. "Lisbon, Portugal". */
export function queriesFor(place, context = '') {
  const base = [place.name, place.addr].filter(Boolean).join(', ');
  const qs = [];
  if (context && !base.toLowerCase().includes(context.split(',')[0].trim().toLowerCase())) qs.push(base + ', ' + context);
  qs.push(base);
  if (place.addr) qs.push(place.addr);
  return [...new Set(qs)];
}

/**
 * Find coordinates for every place that doesn't have them yet, one at a time.
 * Returns new place objects with { lat, lng, found } — `found: false` for ones we couldn't locate
 * (their lat/lng stay null). Stops early if `signal` is aborted.
 *
 * onProgress(done, total) is called after each lookup.
 */
export async function resolvePlaces(places, { context = '', signal, onProgress = () => {}, search = searchPlaces } = {}) {
  const todo = places.filter((p) => p.lat === null).length;
  let done = 0, firstRequest = true;
  const out = [];

  for (const place of places) {
    if (signal?.aborted) break;
    if (place.lat !== null) { out.push({ ...place, found: true }); continue; }

    let hit = null;
    for (const q of queriesFor(place, context)) {
      if (signal?.aborted) break;
      if (!firstRequest) await sleep(GAP_MS, signal);
      firstRequest = false;
      try {
        [hit] = await search(q, { limit: 1, signal });
      } catch {
        hit = null;
      }
      if (hit) break;
    }
    out.push(hit
      ? { ...place, lat: hit.lat, lng: hit.lng, cat: place.cat || hit.cat, found: true }
      : { ...place, found: false });
    onProgress(++done, todo);
  }
  return out;
}
