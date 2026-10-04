// Static map snapshots built from raw OpenStreetMap tiles (no Leaflet instance needed).
// Used for trip covers, the hero background and day thumbnails.

const TILE = 256;
const TILE_URL = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/** Web-Mercator pixel position of a coordinate at zoom z. */
export function worldPx(lat, lng, z) {
  const n = TILE * 2 ** z;
  const r = (lat * Math.PI) / 180;
  return { x: ((lng + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n };
}

/** Highest zoom (≤ maxZoom) at which every point fits inside fillW × fillH pixels. */
export function fitZoom(points, fillW, fillH, maxZoom = 14, minZoom = 3) {
  const la = points.map((p) => p.lat);
  const ln = points.map((p) => p.lng);
  const north = Math.max(...la), south = Math.min(...la), west = Math.min(...ln), east = Math.max(...ln);
  let z = maxZoom;
  for (; z > minZoom; z--) {
    const a = worldPx(north, west, z), b = worldPx(south, east, z);
    if (b.x - a.x <= fillW && b.y - a.y <= fillH) break;
  }
  return z;
}

/** Centre of the bounding box of some points. */
export function boundsCenter(points) {
  const la = points.map((p) => p.lat);
  const ln = points.map((p) => p.lng);
  return { lat: (Math.min(...la) + Math.max(...la)) / 2, lng: (Math.min(...ln) + Math.max(...ln)) / 2 };
}

/**
 * Lay out a w × h snapshot centred on (lat, lng) at zoom z.
 * Returns the tile images to draw and a projector for placing dots on top.
 */
export function snapshot({ lat, lng, z, w, h }) {
  const c = worldPx(lat, lng, z);
  const left = c.x - w / 2, top = c.y - h / 2, n = 2 ** z;
  const tiles = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + h) / TILE); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++) {
      const wrappedX = ((tx % n) + n) % n;
      tiles.push({ key: `${z}/${tx}/${ty}`, src: TILE_URL(z, wrappedX, ty), left: tx * TILE - left, top: ty * TILE - top });
    }
  }
  const project = (p) => {
    const q = worldPx(p.lat, p.lng, z);
    return { x: q.x - left, y: q.y - top };
  };
  return { tiles, project };
}
