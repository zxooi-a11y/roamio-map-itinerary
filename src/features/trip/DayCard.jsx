import { Fragment } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { categoryOf } from '../../lib/categories.js';
import { fmtLong, plural } from '../../lib/dates.js';
import { useCompact } from '../../hooks/useCompact.js';
import { retryRoute, routeSummary } from '../../lib/routing.js';
import { dayColor } from '../../lib/theme.js';
import { TRAVEL_MODES } from '../../lib/trips.js';
import { DayThumb } from './DayThumb.jsx';
import { StopRow } from './StopRow.jsx';

/**
 * One day of the itinerary: a numbered rail, a summary header (always visible)
 * and a collapsible body with date, travel mode, route info and the stop list.
 *
 * On phones (`compact`) the layout is streamlined: no left-hand rail with its dotted line (the cards use the
 * full width and the day number sits inside the card), no category icon before the title, no picture on the
 * right, and the stop names on a single line.
 *
 * `actions` holds the day-level callbacks from TripView, already bound to this trip.
 */
export function DayCard({ day, index, isLast, route, center, drag, actions }) {
  const compact = useCompact();
  const n = index + 1;
  const color = dayColor(index);
  const collapsed = Boolean(day.collapsed);
  const toggle = () => actions.setCollapsed(day.id, !collapsed);
  const summary = routeSummary(route);
  const failed = route?.status === 'fail';

  const toggleProps = {
    type: 'button',
    'aria-expanded': !collapsed,
    'aria-controls': 'body-' + day.id,
    'aria-label': (collapsed ? 'Expand' : 'Collapse') + ' day ' + n,
    onClick: toggle,
  };

  // Clicking empty space on the card toggles it; interactive bits handle their own clicks.
  const onCardClick = (e) => {
    if (e.target.closest('.thumb, .day-title, button, input, select, label, a, .stop, .route-sum')) return;
    if (drag.justDropped()) return;
    toggle();
  };

  return (
    <section className={'day' + (compact ? ' compact' : '') + (collapsed ? ' collapsed' : '') + (isLast ? ' last' : '')} style={{ '--c': color }}
      aria-label={'Day ' + n} data-day-card={day.id}>
      {!compact && (
        <div className="rail">
          <span className="rail-label">Day</span>
          <button className="rail-num" {...toggleProps}>{n}</button>
          <div className="rail-line" />
        </div>
      )}

      <div className="day-card" onClick={onCardClick}>
        <div className="day-head">
          <div className="day-main">
            <div className="day-top">
              {compact && <span className="day-num" aria-hidden="true">{n}</span>}
              {!compact && <span className="day-icon"><Icon name={day.stops[0] ? categoryOf(day.stops[0]) : 'Other'} /></span>}
              <input className="day-title" value={day.title} placeholder="Name this day" aria-label={`Day ${n} title`}
                onChange={(e) => actions.updateDay(day.id, { title: e.target.value })} />
              <button className="day-toggle" {...toggleProps}><Icon name="chevron" /></button>
            </div>
            <StopPreview stops={day.stops} compact={compact} />
          </div>
          {!compact && <DayThumb day={day} dayNumber={n} center={center} onPhoto={(img) => actions.updateDay(day.id, { img })} />}
        </div>

        <div className="day-body" id={'body-' + day.id}>
          <div className="day-meta">
            <input className="date-input" type="date" value={day.date} aria-label={`Date for day ${n}`}
              onChange={(e) => actions.updateDay(day.id, { date: e.target.value })} />
            <span>{fmtLong(day.date)}</span>
            <span>{plural(day.stops.length, 'stop')}</span>
            {summary && (failed
              ? <button className="route-sum retry" type="button" onClick={() => retryRoute(day)}>{summary}</button>
              : <span className="route-sum">{summary}</span>)}
            <div className="modes" role="group" aria-label={`Travel mode for day ${n}`}>
              {TRAVEL_MODES.map((m) => (
                <button key={m.key} className="mode-btn" type="button" data-tip={m.label} aria-label={m.label}
                  aria-pressed={day.mode === m.key} onClick={() => actions.updateDay(day.id, { mode: m.key })}>
                  <Icon name={m.key} />
                </button>
              ))}
            </div>
            <button className="icon-btn" type="button" aria-label={`Show day ${n} on map`} onClick={() => actions.focus(day.id)}>Map</button>
            <button className="icon-btn del" type="button" aria-label={`Delete day ${n}`} onClick={() => actions.removeDay(day)}>✕</button>
          </div>

          <StopList day={day} drag={drag} actions={actions} />

          <button className="add-btn" type="button" onClick={() => actions.addStop(day, index)}>
            <Icon name="plus" />Add stop
          </button>
        </div>
      </div>
    </section>
  );
}

function StopPreview({ stops, compact }) {
  if (!stops.length) return <div className="preview-empty">No stops yet</div>;
  const n = stops.length;
  const shown = n > 4 ? stops.slice(0, 3) : stops;
  const more = n > 4 ? `+${n - 3} more` : '';

  // Phones: one line. Names are separated by dots and cut off with "…" if they don't fit; "+N more" stays visible.
  if (compact) {
    return (
      <div className="preview-line">
        <span className="preview-names">{shown.map((s) => s.name).join(' · ')}</span>
        {more && <span className="preview-more">{more}</span>}
      </div>
    );
  }
  const names = more ? [...shown.map((s) => s.name), more] : shown.map((s) => s.name);
  return <ul className="preview">{names.map((t, i) => <li key={i}>{t}</li>)}</ul>;
}

/** The ordered stops, plus the drop placeholder while a stop is being dragged over this day. */
function StopList({ day, drag, actions }) {
  const t = drag.target;
  const here = t && t.dayId === day.id;
  const placeholder = <li key="__ph" className="stop-ph" style={{ height: t?.height }} />;
  let visibleIdx = 0; // position among stops other than the dragged one
  const others = day.stops.filter((s) => !t || s.id !== t.stopId).length;

  return (
    <ol className={'stops' + (others === 0 && !here ? ' is-empty' : '')}>
      {day.stops.map((s, si) => {
        const isDragged = t && s.id === t.stopId;
        const showPh = here && !isDragged && visibleIdx === t.index;
        if (!isDragged) visibleIdx++;
        return (
          <Fragment key={s.id}>
            {showPh && placeholder}
            <StopRow stop={s} number={si + 1} drag={drag}
              onShow={actions.showStop}
              onRemove={(stopId) => actions.removeStop(day.id, stopId)}
              onCategory={(stopId, cat) => actions.updateStop(stopId, { cat })} />
          </Fragment>
        );
      })}
      {here && t.index >= others && placeholder}
    </ol>
  );
}
