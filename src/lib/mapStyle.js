// The map's look: one place to change the basemap for the interactive map AND the static snapshots
// (trip covers, hero, day thumbnails), so they always match.
//
// With a Mapbox token the site uses Mapbox "Light", a pale minimal style that makes the coloured day routes
// and numbered pins stand out. Without one it falls back to CARTO "Positron", which looks similar and needs
// no key, so the map never breaks.
//
// The token is NOT stored in this repo (GitHub's secret scanning blocks it). It's read at build time from
// VITE_MAPBOX_TOKEN:
//   - on the live site: the repository secret VITE_MAPBOX_TOKEN (Settings -> Secrets and variables -> Actions)
//   - when developing: put VITE_MAPBOX_TOKEN=pk.... in a file named .env.local (git-ignored)
// A Mapbox *public* token (starts "pk.") is meant to be visible in the built site; restrict it to this site's
// address in your Mapbox account (Tokens -> URL restrictions). Never use a secret token (starts "sk.").
//
// Other Mapbox styles: "streets-v12" (colourful), "outdoors-v12", "dark-v11", "satellite-streets-v12".
const MAPBOX_STYLE = 'mapbox/light-v11';

const MAPBOX_ATTRIBUTION =
  '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '<strong><a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener">Improve this map</a></strong>';

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Tile settings for a given Mapbox token ('' = use the free fallback style).
 *   leafletUrl / leafletOptions   for L.tileLayer ({r} becomes "@2x" on high-density screens)
 *   snapshotUrl(z, x, y, retina)  one 256px tile for the static snapshots
 */
export function makeBasemap(token) {
  const mapbox = (z, x, y, r) => `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/tiles/256/${z}/${x}/${y}${r}?access_token=${token}`;
  const carto = (z, x, y, r, s = 'a') => `https://${s}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}${r}.png`;

  if (token) {
    return {
      name: 'mapbox',
      leafletUrl: mapbox('{z}', '{x}', '{y}', '{r}'),
      leafletOptions: { maxZoom: 20, attribution: MAPBOX_ATTRIBUTION },
      snapshotUrl: (z, x, y, retina) => mapbox(z, x, y, retina ? '@2x' : ''),
    };
  }
  return {
    name: 'carto',
    leafletUrl: carto('{z}', '{x}', '{y}', '{r}', '{s}'),
    leafletOptions: { subdomains: 'abcd', maxZoom: 20, attribution: CARTO_ATTRIBUTION },
    snapshotUrl: (z, x, y, retina) => carto(z, x, y, retina ? '@2x' : ''),
  };
}

// `import.meta.env` only exists in the Vite build, so guard for plain Node (the unit tests).
const token = (import.meta.env?.VITE_MAPBOX_TOKEN || '').trim();
const basemap = makeBasemap(token);

export const LEAFLET_TILE_URL = basemap.leafletUrl;
export const LEAFLET_TILE_OPTIONS = basemap.leafletOptions;

const isRetina = () => typeof window !== 'undefined' && window.devicePixelRatio > 1;

/** URL of one 256px tile (served at 512px on high-density screens) for the static snapshots. */
export const snapshotTileUrl = (z, x, y) => basemap.snapshotUrl(z, x, y, isRetina());
