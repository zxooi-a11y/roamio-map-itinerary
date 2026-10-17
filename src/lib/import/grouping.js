import { haversine } from '../timing.js';

/** Is point { x, y } inside the polygon [{ x, y }, ...]? (ray casting; the lasso is drawn in screen pixels) */
export function insidePolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const pathLength = (pts, from) =>
  pts.reduce((sum, p, i) => sum + haversine(i ? pts[i - 1] : from || p, p), 0);

/** Nearest-neighbour walk from `first`: always go to the closest place not visited yet. */
function walk(points, first, from) {
  const left = points.filter((p) => p !== first);
  const out = [first];
  let here = first;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (haversine(here, left[i]) < haversine(here, left[best])) best = i;
    here = left.splice(best, 1)[0];
    out.push(here);
  }
  return { order: out, length: pathLength(out, from) };
}

/**
 * Put places in visiting order so each next place is the closest one left. With `from` (where the day already
 * ends) the walk starts at the place nearest to it; otherwise every start is tried and the shortest walk wins.
 * Points are { lat, lng, ... }; returns them reordered.
 */
export function orderByNearest(points, from = null) {
  if (points.length < 3 && !from) return [...points];
  if (from) {
    const first = points.reduce((a, b) => (haversine(from, b) < haversine(from, a) ? b : a), points[0]);
    return walk(points, first, from).order;
  }
  let best = null;
  for (const start of points) {
    const w = walk(points, start, null);
    if (!best || w.length < best.length) best = w;
  }
  return best.order;
}
