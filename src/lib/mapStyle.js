// The map's look: one place to set the basemap for the interactive map AND the static snapshots
// (trip covers, hero, day thumbnails), so they always match.
//
// Several map servers are tried in order, and the site moves on to the next one by itself when tiles
// stop loading (a server blocked on your network, a usage limit reached, a bad token...):
//   1. Mapbox "Light"     a pale minimal style   (only when a Mapbox token is set)
//   2. CARTO "Positron"   a similar free style
//   3. OpenStreetMap      the standard style, the most widely reachable
//
// The Mapbox token is NOT stored in this repo (GitHub's secret scanning blocks it). It's read at build time
// from VITE_MAPBOX_TOKEN:
//   - on the live site: the repository secret VITE_MAPBOX_TOKEN (Settings -> Secrets and variables -> Actions)
//   - when developing: put VITE_MAPBOX_TOKEN=pk.... in a file named .env.local (git-ignored)
// A Mapbox *public* token (starts "pk.") is meant to be visible in the built site; restrict it to this site's
// address in your Mapbox account (Tokens -> URL restrictions). Never use a secret token (starts "sk.").
//
// Other Mapbox styles: "streets-v12" (colourful), "outdoors-v12", "dark-v11", "satellite-streets-v12".
const MAPBOX_STYLE = 'mapbox/light-v11';

const ATTRIBUTION = {
  mapbox:
    '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ' +
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
    '<strong><a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener">Improve this map</a></strong>',
  carto:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>',
  osm: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

/**
 * The basemaps in the order they're tried. Each has:
 *   leafletUrl / leafletOptions   for L.tileLayer ({r} becomes "@2x" on high-density screens)
 *   snapshotUrl(z, x, y, retina)  one 256px tile for the static snapshots
 */
export function makeBasemaps(token = '') {
  const list = [];
  if (token) {
    const url = (z, x, y, r) => `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/tiles/256/${z}/${x}/${y}${r}?access_token=${token}`;
    list.push({
      name: 'mapbox',
      leafletUrl: url('{z}', '{x}', '{y}', '{r}'),
      leafletOptions: { maxZoom: 20, attribution: ATTRIBUTION.mapbox },
      snapshotUrl: (z, x, y, retina) => url(z, x, y, retina ? '@2x' : ''),
    });
  }
  const carto = (s, z, x, y, r) => `https://${s}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}${r}.png`;
  list.push({
    name: 'carto',
    leafletUrl: carto('{s}', '{z}', '{x}', '{y}', '{r}'),
    leafletOptions: { subdomains: 'abcd', maxZoom: 20, attribution: ATTRIBUTION.carto },
    snapshotUrl: (z, x, y, retina) => carto('a', z, x, y, retina ? '@2x' : ''),
  });
  list.push({
    name: 'osm',
    leafletUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    leafletOptions: { subdomains: 'abc', maxZoom: 19, attribution: ATTRIBUTION.osm },
    snapshotUrl: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  });
  return list;
}

/**
 * Remembers which basemap is in use and moves to the next one when tiles keep failing.
 * Report every tile result with note(ok). After `threshold` failures in a row with no success in between,
 * the next basemap takes over (the last one is never abandoned). subscribe(fn) is called on each switch.
 */
export function createBasemapSelector(basemaps, threshold = 3) {
  let index = 0, failures = 0;
  const listeners = new Set();
  return {
    current: () => basemaps[index],
    note(ok) {
      if (ok) { failures = 0; return; }
      if (++failures >= threshold && index < basemaps.length - 1) {
        index++;
        failures = 0;
        listeners.forEach((fn) => fn());
      }
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

// `import.meta.env` only exists in the Vite build, so guard for plain Node (the unit tests).
const token = (import.meta.env?.VITE_MAPBOX_TOKEN || '').trim();

export const basemapSelector = createBasemapSelector(makeBasemaps(token));

const isRetina = () => typeof window !== 'undefined' && window.devicePixelRatio > 1;

/** URL of one 256px tile (served at 512px on high-density screens) for the static snapshots. */
export const snapshotTileUrl = (z, x, y) => basemapSelector.current().snapshotUrl(z, x, y, isRetina());
