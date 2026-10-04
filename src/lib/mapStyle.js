// The map's look: one place to change the basemap for the interactive map AND the static snapshots
// (trip covers, hero, day thumbnails), so they always match.
//
// CARTO "Positron": a pale, minimal basemap (similar in feel to Mapbox "Light") built on OpenStreetMap
// data. It has far less clutter than the standard OSM style, so the coloured day routes stand out.
// Free to use with attribution, no API key needed. Other CARTO styles: "rastertiles/voyager" (a little
// more colour) or "dark_all". Swap BASEMAP below to try one.
const BASEMAP = 'light_all';

export const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Template for Leaflet's tileLayer. {r} becomes "@2x" on high-density screens, for sharper tiles. */
export const LEAFLET_TILE_URL = `https://{s}.basemaps.cartocdn.com/${BASEMAP}/{z}/{x}/{y}{r}.png`;
export const LEAFLET_TILE_OPTIONS = { subdomains: 'abcd', maxZoom: 20, attribution: ATTRIBUTION };

const retinaSuffix = () => (typeof window !== 'undefined' && window.devicePixelRatio > 1 ? '@2x' : '');

/** URL of one 256px tile (served at 512px on high-density screens) for the static snapshots. */
export const snapshotTileUrl = (z, x, y) => `https://a.basemaps.cartocdn.com/${BASEMAP}/${z}/${x}/${y}${retinaSuffix()}.png`;
