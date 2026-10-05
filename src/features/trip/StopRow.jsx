import { Icon } from '../../components/Icon.jsx';
import { useCompact } from '../../hooks/useCompact.js';
import { CATEGORIES, categoryOf } from '../../lib/categories.js';

/**
 * One stop in a day's list: grip, time, number pin, name, category, note, remove.
 * On phones the time is shown inline before the name, so the name can use the whole line.
 */
export function StopRow({ stop, number, onShow, onRemove, onCategory, drag }) {
  const compact = useCompact();
  const cat = categoryOf(stop);
  const show = (e) => { e.stopPropagation(); onShow(stop); };

  return (
    <li className="stop" data-stop={stop.id}
      onPointerDown={(e) => drag.armPress(e, stop.id)}
      onContextMenu={(e) => e.preventDefault()}>
      <button className="icon-btn grip" type="button" aria-label={'Drag to reorder ' + stop.name} title="Drag to reorder"
        onPointerDown={(e) => drag.startDrag(e, stop.id)}>⋮⋮</button>
      {!compact && <div className="stop-time">{stop.time}</div>}
      <div className="stop-main" onClick={show}>
        <div className="stop-title">
          <button className="pin" type="button" aria-label={'Show ' + stop.name + ' on map'} onClick={show}>{number}</button>
          {compact && stop.time && <span className="stop-time">{stop.time}</span>}
          <span className="stop-name">{stop.name}</span>
          <label className="tag" data-tip={cat} onClick={(e) => e.stopPropagation()}>
            <Icon name={cat} />
            <select aria-label={`Category for ${stop.name}: ${cat}`} value={cat} onChange={(e) => onCategory(stop.id, e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        {stop.note && <div className="stop-note">{stop.note}</div>}
      </div>
      <div className="stop-actions">
        <button className="icon-btn del" type="button" aria-label={'Remove ' + stop.name} onClick={() => onRemove(stop.id)}>✕</button>
      </div>
    </li>
  );
}
