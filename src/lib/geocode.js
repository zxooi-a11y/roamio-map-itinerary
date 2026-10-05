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
