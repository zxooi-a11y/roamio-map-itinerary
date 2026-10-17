import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from '../../components/Icon.jsx';
import { useBasemap } from '../../hooks/useBasemap.js';
import { addDays, fmtLong, plural } from '../../lib/dates.js';
import { insidePolygon, orderByNearest } from '../../lib/import/grouping.js';
import { basemapSelector } from '../../lib/mapStyle.js';
import { dayColor } from '../../lib/theme.js';
import { effectiveDates } from '../../lib/tripDates.js';

let nextGroup = 1;

/**
 * Step two of "Import places": every place from the file on a map. Draw around a group of places (lasso), say which
 * day of the range they're for and name the day; repeat. Nothing is added to the trip until Submit: then each day's
 * places are put in visiting order, each next place being the closest one left (starting near where the day already
 * ends, if it has stops), and handed to onSubmit({ items: [{ offset, stop }], titles: { offset: name } }).
 *
 *   stops   the places, already looked up (each { id, name, lat, lng, ... })
 *   start   first date of the range ('' for an undated trip: days are numbered instead); span = number of days
 */
export function ImportPlanner({ trip, stops, start, span, onSubmit, onBack, onCancel }) {
  const [groups, setGroups] = useState([]); // [{ id, offset, name, ids: [] }]
  const [pending, setPending] = useState(null); // { ids, offset, name } after a lasso, until saved
  const [lasso, setLasso] = useState(true); // drawing (true) or moving the map (false)
  const [path, setPath] = useState(null); // screen points of the lasso being drawn
  const [note, setNote] = useState('');
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const basemap = useBasemap();

  const groupOf = useMemo(() => {
    const m = new Map();
    groups.forEach((g) => g.ids.forEach((id) => m.set(id, g)));
    return m;
  }, [groups]);

  // The days of the range, with what the trip already has on them
  const dayOptions = useMemo(() => {
    const eff = effectiveDates(trip.days);
    return Array.from({ length: span }, (_, k) => {
      const date = start ? addDays(start, k) : '';
      const existing = start ? trip.days[eff ? eff.indexOf(date) : -1] : trip.days[k];
      return { offset: k, label: (start ? fmtLong(date) : 'Day ' + (k + 1)) + (existing?.title ? ' · ' + existing.title : ''), existing };
    });
  }, [trip.days, start, span]);

  // Map: created once, fitted to the places
  useEffect(() => {
    const map = L.map(mapEl.current, { zoomControl: true, scrollWheelZoom: true });
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const pts = stops.map((s) => [s.lat, s.lng]);
    const fit = () => (pts.length ? map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }) : map.setView([20, 0], 2));
    fit();
    // the overlay may not have its size yet when the map is made: re-measure (and re-fit the first time) once it does
    let fitted = mapEl.current.clientHeight > 0;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      if (!fitted && mapEl.current?.clientHeight > 0) { fitted = true; fit(); }
    });
    ro.observe(mapEl.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const layer = L.tileLayer(basemap.leafletUrl, basemap.leafletOptions)
      .on('tileload', () => basemapSelector.note(true)).on('tileerror', () => basemapSelector.note(false))
      .addTo(mapRef.current);
    return () => { layer.remove(); };
  }, [basemap]);

  // Lasso mode: the map stays still so a drag draws instead of panning
  useEffect(() => {
    const map = mapRef.current;
    const handlers = [map.dragging, map.touchZoom, map.doubleClickZoom, map.boxZoom];
    handlers.forEach((h) => (lasso ? h.disable() : h.enable()));
  }, [lasso]);

  // Markers: grey until they're in a day, then that day's colour and number
  useEffect(() => {
    const layer = layerRef.current;
    layer.clearLayers();
    const selected = new Set(pending?.ids || []);
    stops.forEach((s) => {
      const g = groupOf.get(s.id);
      const color = g ? dayColor(g.offset) : '#8a8f98';
      const html = `<div class="ip-dot${selected.has(s.id) ? ' is-sel' : ''}" style="--c:${color}">${g ? g.offset + 1 : ''}</div>`;
      const strong = document.createElement('strong');
      strong.textContent = s.name;
      L.marker([s.lat, s.lng], { icon: L.divIcon({ className: '', html, iconSize: [22, 22], iconAnchor: [11, 11] }), title: s.name })
        .bindPopup(strong).addTo(layer);
    });
  }, [stops, groupOf, pending]);

  // Drawing the lasso
  const local = (e) => {
    const r = mapEl.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => {
    if (pending) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setPath([local(e)]);
    setNote('');
  };
  const move = (e) => { if (path) setPath((p) => [...p, local(e)]); };
  const up = () => {
    if (!path) return;
    const poly = path;
    setPath(null);
    if (poly.length < 3) return;
    const map = mapRef.current;
    const ids = stops.filter((s) => insidePolygon(map.latLngToContainerPoint([s.lat, s.lng]), poly)).map((s) => s.id);
    if (!ids.length) { setNote('No places inside that loop. Draw around the dots.'); return; }
    const used = new Set(groups.map((g) => g.offset));
    const free = dayOptions.find((d) => !used.has(d.offset));
    const offset = free ? free.offset : 0;
    setPending({ ids, offset, name: groups.find((g) => g.offset === offset)?.name || '' });
  };

  const savePending = () => {
    const { ids, offset, name } = pending;
    setGroups((gs) => {
      // a place belongs to one day: take the lassoed places out of any other day first
      const pick = new Set(ids);
      let out = gs.map((g) => ({ ...g, ids: g.ids.filter((id) => !pick.has(id)) }));
      const same = out.find((g) => g.offset === offset);
      out = same
        ? out.map((g) => (g === same ? { ...g, name: name.trim() || g.name, ids: [...g.ids, ...ids] } : g))
        : [...out, { id: nextGroup++, offset, name: name.trim(), ids }];
      return out.filter((g) => g.ids.length).sort((a, b) => a.offset - b.offset);
    });
    setPending(null);
  };

  const grouped = groupOf.size;
  const submit = () => {
    const left = stops.length - grouped;
    if (!grouped) return;
    if (left && !confirm(`${plural(left, 'place')} ${left === 1 ? "isn't" : "aren't"} in a day and won't be added. Add the rest?`)) return;
    const byId = new Map(stops.map((s) => [s.id, s]));
    const items = [];
    const titles = {};
    for (const g of groups) {
      const prev = dayOptions[g.offset].existing?.stops.at(-1) || null;
      for (const stop of orderByNearest(g.ids.map((id) => byId.get(id)), prev)) items.push({ offset: g.offset, stop });
      if (g.name) titles[g.offset] = g.name;
    }
    onSubmit({ items, titles });
  };

  return (
    <div className="ip-planner" role="dialog" aria-modal="true" aria-labelledby="ip-plan-title">
      <header className="ip-bar">
        <button className="icon-btn" type="button" aria-label="Back to the file" onClick={onBack}><Icon name="back" /></button>
        <div className="ip-bar-text">
          <h2 id="ip-plan-title">Group places into days</h2>
          <p>{grouped} of {plural(stops.length, 'place')} in a day</p>
        </div>
        <button className="btn-plain" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn" type="button" disabled={!grouped || Boolean(pending)} onClick={submit}>Submit</button>
      </header>

      <div className="ip-map-wrap">
        <div className="ip-map" ref={mapEl} />
        {lasso && !pending && (
          <svg className="ip-lasso" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setPath(null)}>
            {path && <polyline points={path.map((p) => p.x + ',' + p.y).join(' ')} />}
          </svg>
        )}
        <div className="ip-tools">
          <button className="ip-tool" type="button" aria-pressed={lasso} onClick={() => setLasso(true)}><Icon name="edit" />Draw</button>
          <button className="ip-tool" type="button" aria-pressed={!lasso} onClick={() => setLasso(false)}><Icon name="Other" />Move map</button>
        </div>
        {lasso && !pending && !path && <div className="ip-hint">{note || 'Draw a loop around the places for one day.'}</div>}
      </div>

      <div className="ip-panel">
        {pending ? (
          <form className="ip-form" onSubmit={(e) => { e.preventDefault(); savePending(); }}>
            <strong>{plural(pending.ids.length, 'place')} selected</strong>
            <label className="ad-lbl" htmlFor="ip-day">Which day</label>
            <select className="ad-in" id="ip-day" value={pending.offset}
              onChange={(e) => { const offset = +e.target.value; setPending((p) => ({ ...p, offset, name: p.name || groups.find((g) => g.offset === offset)?.name || '' })); }}>
              {dayOptions.map((d) => <option key={d.offset} value={d.offset}>{d.label}</option>)}
            </select>
            <label className="ad-lbl" htmlFor="ip-name">Name of the day (optional)</label>
            <input className="ad-in" id="ip-name" autoFocus placeholder="e.g. Montmartre and the Marais" value={pending.name}
              onChange={(e) => setPending((p) => ({ ...p, name: e.target.value }))} />
            <div className="ip-form-btns">
              <button className="btn-plain" type="button" onClick={() => setPending(null)}>Cancel</button>
              <button className="btn" type="submit">Save day</button>
            </div>
          </form>
        ) : groups.length ? (
          <ul className="ip-groups">
            {groups.map((g) => (
              <li key={g.id} style={{ '--c': dayColor(g.offset) }}>
                <span className="ip-num">{g.offset + 1}</span>
                <span className="ip-g-text">
                  <span className="ip-g-day">{dayOptions[g.offset].label}{g.name ? ' · ' + g.name : ''}</span>
                  <span className="ip-g-count">{plural(g.ids.length, 'place')}</span>
                </span>
                <button className="icon-btn del" type="button" aria-label={'Remove ' + dayOptions[g.offset].label}
                  onClick={() => setGroups((gs) => gs.filter((x) => x !== g))}>✕</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ip-empty">Each loop you draw becomes a day. Places are added in the order that keeps each next one closest.</p>
        )}
      </div>
    </div>
  );
}
