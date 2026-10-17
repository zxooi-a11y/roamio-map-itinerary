import { Icon } from '../../components/Icon.jsx';
import { useCompact } from '../../hooks/useCompact.js';
import { CATEGORIES, categoryOf } from '../../lib/categories.js';
import { formatDistance, formatDuration } from '../../lib/routing.js';
import { haversine } from '../../lib/timing.js';
import { TRAVEL_MODES } from '../../lib/trips.js';

/**
 * One stop in a day's list: the leg into it (how long it takes), then grip, time,
 * number pin, name, category, how to get there, note, remove. The time can be edited right here (a typed time is kept
 * unless there isn't time to get there; clear it to let it follow the travel again).
 * On phones the time is shown inline before the name, so the name can use the whole line.
 */
export function StopRow({ stop, number, leg, onShow, onRemove, onCategory, onTime, onTravel, drag }) {
  const compact = useCompact();
  const cat = categoryOf(stop);
  const modeLabel = leg ? (TRAVEL_MODES.find((m) => m.key === leg.mode)?.label || 'Walking') : '';
  const show = (e) => { e.stopPropagation(); onShow(stop); };
  const timeInput = (
    <input className="stop-time-in" type="time" value={stop.time || ''} aria-label={'Time for ' + stop.name}
      onClick={(e) => e.stopPropagation()} onChange={(e) => onTime(stop.id, e.target.value)} />
  );

  return (
    <li className="stop" data-stop={stop.id}
      onPointerDown={(e) => drag.armPress(e, stop.id)}
      onContextMenu={(e) => e.preventDefault()}>
      {leg && <LegRow leg={leg} stop={stop} />}
      <button className="icon-btn grip" type="button" aria-label={'Drag to reorder ' + stop.name} title="Drag to reorder"
        onPointerDown={(e) => drag.startDrag(e, stop.id)}>⋮⋮</button>
      {!compact && <div className="stop-time">{timeInput}</div>}
      <div className="stop-main" onClick={show}>
        <div className="stop-title">
          <button className="pin" type="button" aria-label={'Show ' + stop.name + ' on map'} onClick={show}>{number}</button>
          {compact && <span className="stop-time">{timeInput}</span>}
          <span className="stop-name">{stop.name}</span>
          <label className="tag" data-tip={cat} onClick={(e) => e.stopPropagation()}>
            <Icon name={cat} />
            <select aria-label={`Category for ${stop.name}: ${cat}`} value={cat} onChange={(e) => onCategory(stop.id, e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {leg && (
            <label className="tag travel" data-tip={'Getting here: ' + modeLabel} onClick={(e) => e.stopPropagation()}>
              <Icon name={leg.mode} />
              <select aria-label={`How to get to ${stop.name}: ${modeLabel}`} value={leg.mode} onChange={(e) => onTravel(stop.id, e.target.value)}>
                {TRAVEL_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
          )}
        </div>
        {stop.note && <div className="stop-note">{stop.note}</div>}
      </div>
      <div className="stop-actions">
        <button className="icon-btn del" type="button" aria-label={'Remove ' + stop.name} onClick={() => onRemove(stop.id)}>✕</button>
      </div>
    </li>
  );
}

/** The way from the previous stop to this one: how long it takes and how far (the mode is the circle beside the category). */
function LegRow({ leg, stop }) {
  const { route, seconds, mode } = leg;
  const loading = !route || route.status === 'loading';
  // a route whose time had to be raised a lot (the service answered nonsense for this distance) is shown as an estimate
  const unreliable = !loading && route.status === 'ok' && (route.dist < haversine(leg.from, leg.to) * 0.9 || (mode !== 'transit' && seconds > route.dur * 1.5));
  const estimated = !loading && (route.status !== 'ok' || route.approx || unreliable || mode === 'transit');
  return (
    <div className="leg" data-leg={stop.id}>
      <span className="leg-info">
        {loading ? 'Finding route…' : <>{formatDuration(seconds)}{route.status === 'ok' && !unreliable && ' · ' + formatDistance(route.dist)}{estimated && ' (est.)'}</>}
      </span>
    </div>
  );
}
