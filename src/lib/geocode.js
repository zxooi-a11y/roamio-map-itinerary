import { guessCategory } from './categories.js';

/**
 * Search places with OpenStreetMap Nominatim.
 * @param {string} q
 * @param {{ limit?: number, viewbox?: [west, north, east, south], countryCodes?: string, signal?: AbortSignal }} opts
 *   countryCodes  limit results to these countries, e.g. "jp" or "jp,kr"
 * @returns {Promise<Array<{ name, addr, city, country, countryCode, lat, lng, cat }>>}
 */
export async function searchPlaces(q, { limit = 6, viewbox, countryCodes, signal } = {}) {
  const params = new URLSearchParams({ format: 'jsonv2', limit: String(limit), addressdetails: '1', q });
  if (viewbox) params.set('viewbox', viewbox.join(','));
  if (countryCodes) params.set('countrycodes', countryCodes);
  const res = await fetch('https://nominatim.openstreetmap.org/search?' + params, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Unexpected response');
  return data.map((r) => parseResult(r, q));
}

/** Turn a Nominatim result into a display name + address line. */
export function parseResult(r, q = '') {
  const parts = (r.display_name || '').split(',').map((x) => x.trim()).filter(Boolean);
  const name = r.name || parts[0] || q;
  const addr = parts.slice(r.name ? 0 : 1).filter((x) => x !== name).join(', ');
  const a = r.address || {};
  return {
    name,
    addr,
    city: a.city || a.town || a.village || a.municipality || a.county || a.state || '',
    country: a.country || (parts.length > 1 ? parts[parts.length - 1] : ''),
    countryCode: (a.country_code || '').toLowerCase(),
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    cat: guessCategory(name, r.category, r.type),
  };
}

/* ---------- More sources, still free and keyless ---------- */

const PHOTON = 'https://photon.komoot.io/api/';

/** Turn a Photon (OpenStreetMap) feature into the same shape as parseResult. */
export function parsePhoton(f, q = '') {
  const p = f.properties || {};
  const [lng, lat] = f.geometry?.coordinates || [];
  const name = p.name || p.street || q;
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const addr = [street && street !== name ? street : '', p.district, p.city || p.town, p.state, p.country]
    .filter((x, i, all) => x && x !== name && all.indexOf(x) === i).join(', ');
  return {
    name,
    addr,
    city: p.city || p.town || p.village || p.county || p.state || '',
    country: p.country || '',
    countryCode: (p.countrycode || '').toLowerCase(),
    lat,
    lng,
    cat: guessCategory(name, p.osm_key, p.osm_value),
  };
}

/** Search with Photon, which ranks OpenStreetMap places differently and forgives typos. */
export async function searchPhoton(q, { limit = 6, viewbox, countryCodes, signal } = {}) {
  const params = new URLSearchParams({ q, limit: String(limit + 4), lang: 'en' });
  if (viewbox) { const [w, n, e, s] = viewbox; params.set('bbox', [w, s, e, n].join(',')); }
  const res = await fetch(PHOTON + '?' + params, { signal });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data.features)) throw new Error('Unexpected response');
  const only = countryCodes ? countryCodes.toLowerCase().split(',').map((c) => c.trim()) : null;
  return data.features.map((f) => parsePhoton(f, q))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && (!only || !r.countryCode || only.includes(r.countryCode)));
}

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Same place from two sources: within ~100 m and one name contains the other. */
function samePlace(a, b) {
  if (Math.abs(a.lat - b.lat) > 0.001 || Math.abs(a.lng - b.lng) > 0.001) return false;
  const x = norm(a.name), y = norm(b.name);
  return !x || !y || x.includes(y) || y.includes(x);
}

/** Merge result lists in order, dropping a result that repeats one already kept. */
export function mergeResults(lists, max = 8) {
  const out = [];
  for (const list of lists) for (const r of list) if (!out.some((k) => samePlace(k, r))) out.push(r);
  return out.slice(0, max);
}

/**
 * What a pasted Google Maps place link says: { name, lat, lng }. Handles /maps/place/<name>/@lat,lng links, !3d!4d
 * data parameters and ?q=lat,lng. null if the text isn't a Google Maps link; short links (maps.app.goo.gl) carry
 * nothing readable, so they give { short: true }.
 */
export function parseGoogleMapsUrl(text) {
  let u;
  try { u = new URL(String(text).trim()); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'maps.app.goo.gl' || host === 'goo.gl') return { short: true };
  if (!/^(maps\.)?google\.[a-z.]+$/.test(host) || (host.startsWith('google.') && !u.pathname.startsWith('/maps'))) return null;
  const path = decodeURIComponent(u.pathname.replace(/\+/g, ' '));
  const nameMatch = path.match(/\/maps\/(?:place|search)\/([^/@]+)/);
  const name = nameMatch ? nameMatch[1].trim() : (u.searchParams.get('q') || '').trim();
  const at = (u.pathname + u.hash).match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || u.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const q = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(u.searchParams.get('q') || '');
  const c = at || q;
  const lat = c ? parseFloat(c[1]) : null, lng = c ? parseFloat(c[2]) : null;
  const text0 = q ? '' : name;
  if (!text0 && lat === null) return null;
  return { name: text0, lat, lng };
}

/** Fill in city / country for coordinates with Nominatim's reverse lookup. */
export async function reverseGeocode(lat, lng, signal) {
  const params = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), addressdetails: '1', zoom: '18' });
  const res = await fetch('https://nominatim.openstreetmap.org/reverse?' + params, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/**
 * The place search used when saving a place: a pasted Google Maps link is read directly; anything else searches
 * Nominatim and Photon together and merges what they find (if one is down, the other still answers).
 */
export async function searchAllPlaces(q, opts = {}) {
  const g = parseGoogleMapsUrl(q);
  if (g?.short) return []; // can't be read from a browser: the box tells the user to open it and copy the full link
  if (g) {
    if (g.lat !== null) {
      const here = { name: g.name || 'Pinned place', addr: '', city: '', country: '', countryCode: '', lat: g.lat, lng: g.lng, cat: guessCategory(g.name) };
      try {
        const r = parseResult(await reverseGeocode(g.lat, g.lng, opts.signal), g.name);
        return [{ ...r, name: g.name || r.name, lat: g.lat, lng: g.lng, cat: guessCategory(g.name || r.name) }];
      } catch (e) { if (opts.signal?.aborted) throw e; return [here]; }
    }
    return searchAllPlaces(g.name, opts);
  }
  const settled = await Promise.allSettled([searchPlaces(q, opts), searchPhoton(q, opts)]);
  if (settled.every((s) => s.status === 'rejected')) throw settled[0].reason;
  return mergeResults(settled.map((s) => (s.status === 'fulfilled' ? s.value : [])), (opts.limit || 6) + 2);
}
