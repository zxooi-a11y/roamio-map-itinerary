import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useCompact } from '../../hooks/useCompact.js';
import { useRoutes } from '../../hooks/useRoute.js';
import { plural } from '../../lib/dates.js';
import { describePlan, planDates } from '../../lib/tripDates.js';
import { summaryLine } from '../../lib/trips.js';
import { useTrips } from '../../store/TripsProvider.jsx';
import { AddStopDialog } from './AddStopDialog.jsx';
import { DayCard } from './DayCard.jsx';
import { DayFilters } from './DayFilters.jsx';
import { TripDates } from './TripDates.jsx';
import { TripMap } from './TripMap.jsx';
import { useStopDrag } from './useStopDrag.js';

/** The planner for one trip: title, sticky map + day chips, and the list of days. */
export function TripView({ trip }) {
  const { dispatch } = useTrips();
  const toast = useToast();
  const compact = useCompact();
  const tripId = trip.id;
  const [focusDayId, setFocusDayId] = useState(null);
  const [fitNonce, setFitNonce] = useState(0);
  const [adding, setAdding] = useState(null); // { day, index } while the Add stop pop-up is open
  const mapApi = useRef(null);
  const stickyRef = useRef(null);
  const routes = useRoutes(trip.days);

  // A deleted day can't stay focused.
  const focus = trip.days.some((d) => d.id === focusDayId) ? focusDayId : null;
  const refit = () => setFitNonce((n) => n + 1);

  useEffect(() => { document.title = (trip.title || 'Trip') + ' · Trip planner'; }, [trip.title]);
  useEffect(() => { window.scrollTo(0, 0); }, [tripId]);

  // Day cards scroll to just below the sticky map; keep that offset and the map size in sync.
  useEffect(() => {
    const el = stickyRef.current;
    const sync = () => {
      document.documentElement.style.setProperty('--stick-h', el.offsetHeight + 'px');
      mapApi.current?.resize();
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const drag = useStopDrag({
    onDrop: (stopId, toDayId, toIndex) => dispatch({ type: 'stop/move', tripId, stopId, toDayId, toIndex }),
    getTopEdge: () => stickyRef.current?.getBoundingClientRect().bottom ?? 0,
  });

  const actions = useMemo(() => ({
    updateDay: (dayId, patch) => dispatch({ type: 'day/update', tripId, dayId, patch }),
    setCollapsed: (dayId, collapsed) => dispatch({ type: 'day/setCollapsed', tripId, dayId, collapsed }),
    removeDay: (day) => {
      if (day.stops.length && !confirm(`Delete this day and its ${plural(day.stops.length, 'stop')}?`)) return;
      dispatch({ type: 'day/remove', tripId, dayId: day.id });
      refit();
    },
    updateStop: (stopId, patch) => dispatch({ type: 'stop/update', tripId, stopId, patch }),
    removeStop: (dayId, stopId) => dispatch({ type: 'stop/remove', tripId, dayId, stopId }),
    showStop: (stop) => mapApi.current?.flyTo(stop),
    addStop: (day, index) => setAdding({ day, index }),
    focus: (dayId) => { setFocusDayId(dayId); refit(); },
  }), [dispatch, tripId]);

  // Tap a day chip: highlight it on the map, open its card and scroll to it.
  const jumpToDay = (dayId) => {
    actions.focus(dayId);
    actions.setCollapsed(dayId, false);
    requestAnimationFrame(() =>
      document.querySelector(`[data-day-card="${dayId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Start / end date edited: add, remove or move days to fit. Removing days that hold stops needs a yes.
  const changeDates = (start, end, edited) => {
    const plan = planDates(trip, { start, end }, edited);
    if (!plan || !plan.changed) return;
    if (plan.droppedStops > 0 &&
        !confirm(`This removes ${plural(plan.droppedDays, 'day')} with ${plural(plan.droppedStops, 'stop')} in ${plan.droppedDays === 1 ? 'it' : 'them'}. Continue?`)) return;
    dispatch({ type: 'trip/setDates', tripId, start, end, edited });
    refit();
    const message = describePlan(plan);
    if (message) toast(message);
  };

  const addStop = (stop) => {
    dispatch({ type: 'stop/add', tripId, dayId: adding.day.id, stop });
    setAdding(null);
    mapApi.current?.flyTo(stop);
  };

  return (
    <div className="trip-view">
      <header className="trip-header">
        <a className="back" href="#/"><Icon name="back" />All trips</a>
        <input className="title-input" aria-label="Trip name" value={trip.title}
          onChange={(e) => dispatch({ type: 'trip/update', tripId, patch: { title: e.target.value } })} />
        <p className="subtitle">{summaryLine(trip, { withDates: false })}</p>
        <TripDates trip={trip} onChange={changeDates} showHint={!compact} />
      </header>

      <div className="stickytop" ref={stickyRef}>
        <section className="map-wrap" aria-label="Trip map">
          <TripMap trip={trip} routes={routes} focusDayId={focus} fitToken={`${tripId}|${focus}|${fitNonce}`} apiRef={mapApi}
            onMoveStop={(stopId, lat, lng) => actions.updateStop(stopId, { lat, lng })} />
        </section>
        <DayFilters days={trip.days} focusDayId={focus} onAll={() => actions.focus(null)} onDay={jumpToDay} />
      </div>

      <main className="days">
        {trip.days.map((day, i) => (
          <DayCard key={day.id} day={day} index={i} isLast={i === trip.days.length - 1}
            route={routes[i]} center={trip.center} drag={drag} actions={actions} />
        ))}
        <button className="btn ghost" type="button" onClick={() => dispatch({ type: 'day/add', tripId })}>+ Add a day</button>
      </main>

      {adding && (
        <AddStopDialog day={adding.day} dayIndex={adding.index} map={mapApi.current}
          onClose={() => setAdding(null)} onAdd={addStop} />
      )}
    </div>
  );
}
