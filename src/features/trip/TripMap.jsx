import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { dayColor } from '../../lib/theme.js';

const WORLD_VIEW = [[20, 0], 2];

function numberIcon(n, color, dim) {
  return L.divIcon({
    className: '',
    html: `<div class="num-marker${dim ? ' dim' : ''}" style="--c:${color}">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Popup content built as a DOM node so place names are never parsed as HTML. */
function popupContent(name) {
  const strong = document.createElement('strong');
  strong.textContent = name;
  return strong;
}

/**
 * The Leaflet map for a trip: numbered markers per day, road routes (or dotted
 * straight lines while they load), with days other than `focusDayId` dimmed.
 *
 * Leaflet manages its own DOM, so this component drives it imperatively from effects.
 * Parent gets an API through `apiRef`: flyTo(stop), getCenter(), getViewbox(), resize().
 * The view re-fits whenever `fitToken` changes.
 */
export function TripMap({ trip, routes, focusDayId, fitToken, onMoveStop, apiRef }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef(new Map());
  const onMoveRef = useRef(onMoveStop);
  onMoveRef.current = onMoveStop;

  // Create the map once.
  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl: true, scrollWheelZoom: false }).setView(...WORLD_VIEW);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    apiRef.current = {
      flyTo(stop) {
        map.flyTo([stop.lat, stop.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
        setTimeout(() => markersRef.current.get(stop.id)?.openPopup(), 850);
      },
      getCenter: () => map.getCenter(),
      getViewbox() {
        const b = map.getBounds();
        return [b.getWest(), b.getNorth(), b.getEast(), b.getSouth()];
      },
      resize: () => map.invalidateSize(),
    };
    return () => {
      apiRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [apiRef]);

  // Redraw markers and lines whenever the trip, the focus or a route changes.
  const routeSig = routes.map((r) => r?.status || '').join(',');
  useEffect(() => {
    const layer = layerRef.current;
    layer.clearLayers();
    markersRef.current.clear();

    trip.days.forEach((day, di) => {
      const dim = focusDayId !== null && focusDayId !== day.id;
      const color = dayColor(di);

      day.stops.forEach((s, si) => {
        const m = L.marker([s.lat, s.lng], { icon: numberIcon(si + 1, color, dim), draggable: true, title: s.name, zIndexOffset: dim ? 0 : 500 })
          .bindPopup(() => popupContent(s.name))
          .on('dragend', () => {
            const p = m.getLatLng();
            onMoveRef.current(s.id, p.lat, p.lng);
          })
          .addTo(layer);
        markersRef.current.set(s.id, m);
      });

      if (day.stops.length > 1) {
        const r = routes[di];
        if (r?.status === 'ok') {
          const line = { lineCap: 'round', lineJoin: 'round', smoothFactor: 0 };
          L.polyline(r.pts, { ...line, color: '#fff', weight: 8, opacity: dim ? 0.15 : 0.7 }).addTo(layer);
          L.polyline(r.pts, { ...line, color, weight: 5, opacity: dim ? 0.25 : 0.9 }).addTo(layer);
        } else {
          // While the road route loads (or if it can't be fetched): dotted straight line
          L.polyline(day.stops.map((s) => [s.lat, s.lng]), { color, weight: 3, opacity: dim ? 0.2 : 0.6, dashArray: '2 8', lineCap: 'round' }).addTo(layer);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.days, focusDayId, routeSig]);

  // Fit the view to the focused stops (or the trip's destination, or the world).
  useEffect(() => {
    const map = mapRef.current;
    const pts = trip.days
      .filter((d) => focusDayId === null || d.id === focusDayId)
      .flatMap((d) => d.stops.map((s) => [s.lat, s.lng]));
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    else if (trip.center) map.setView([trip.center.lat, trip.center.lng], 11);
    else map.setView(...WORLD_VIEW);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken]);

  return <div id="map" ref={elRef} role="application" aria-label="Interactive map of your stops" />;
}
