import { useBasemap } from '../hooks/useBasemap.js';
import { basemapSelector } from '../lib/mapStyle.js';
import { boundsCenter, fitZoom, snapshot } from '../lib/tiles.js';
import { Icon } from './Icon.jsx';

/**
 * A static OpenStreetMap picture of some points, w × h px.
 * Shows a dot per point (`dots`), or a single centred pin (`pin`).
 * Falls back to `center` when there are no points, or to a placeholder icon.
 */
export function MapSnapshot({ points, center, w, h, maxZoom = 14, dots = true, pin = false, className = 'cover' }) {
  useBasemap(); // tile URLs depend on the basemap in use
  let view = null;
  if (points.length) {
    view = { ...boundsCenter(points), z: fitZoom(points, w * 0.72, h * 0.62, maxZoom) };
  } else if (center) {
    view = { ...center, z: 11 };
  }

  if (!view) {
    return (
      <div className={className}>
        <span className="cover-empty"><Icon name="Other" /></span>
      </div>
    );
  }

  const { tiles, project } = snapshot({ ...view, w, h });
  return (
    <div className={className}>
      {tiles.map((t) => (
        <img key={t.key} src={t.src} alt="" draggable="false" loading="lazy"
          onLoad={() => basemapSelector.note(true)} onError={() => basemapSelector.note(false)}
          style={{ left: t.left, top: t.top, width: 256, height: 256 }} />
      ))}
      {dots && points.map((p, i) => {
        const { x, y } = project(p);
        return x >= 0 && x <= w && y >= 0 && y <= h
          ? <span key={i} className="cover-dot" style={{ left: x, top: y }} />
          : null;
      })}
      {pin && <span className="thumb-pin" />}
    </div>
  );
}
