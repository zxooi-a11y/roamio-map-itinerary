import { Icon } from '../../components/Icon.jsx';
import { MapSnapshot } from '../../components/MapSnapshot.jsx';
import { tripHref } from '../../hooks/useHashRoute.js';
import { fmtRange } from '../../lib/dates.js';
import { badgeText, metaText, tripPhase, tripRange, tripTitle } from '../../lib/trips.js';

const allStops = (trip) => trip.days.flatMap((d) => d.stops);

function DeleteButton({ trip, className, onDelete }) {
  return (
    <button className={className} type="button" aria-label={'Delete ' + tripTitle(trip)} title="Delete trip"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(trip); }}>
      <Icon name="trash" />
    </button>
  );
}

/** A card in the horizontal "Your trips" scroller. */
export function TripCard({ trip, today, onDelete }) {
  const range = tripRange(trip);
  const badge = badgeText(trip, today);
  return (
    <a className="trip-card" href={tripHref(trip.id)} aria-label={tripTitle(trip) + ', ' + badge}>
      <div className="trip-cover">
        <MapSnapshot points={allStops(trip)} center={trip.center} w={240} h={140} />
        <span className={'trip-badge ' + tripPhase(trip, today)}>{badge}</span>
        <DeleteButton trip={trip} className="trip-del" onDelete={onDelete} />
      </div>
      <div className="trip-body">
        <div className="trip-name">{tripTitle(trip)}</div>
        {trip.place && <div className="trip-place">{trip.place}</div>}
        <div className="trip-dates">{range ? fmtRange(range.start, range.end) : 'Dates not set'}</div>
        <div className="trip-meta">{metaText(trip)}</div>
      </div>
    </a>
  );
}

/** A compact row in the "Past trips" grid. */
export function PastTripRow({ trip, onDelete }) {
  const range = tripRange(trip);
  return (
    <a className="past-row" href={tripHref(trip.id)} aria-label={tripTitle(trip) + ', completed'}>
      <MapSnapshot points={allStops(trip)} center={trip.center} w={64} h={64} />
      <div className="past-text">
        <div className="trip-name">{tripTitle(trip)}</div>
        <div className="trip-dates">{(range ? fmtRange(range.start, range.end) : '') + (trip.place ? ' · ' + trip.place : '')}</div>
        <div className="trip-meta">{metaText(trip)}</div>
      </div>
      <DeleteButton trip={trip} className="past-del" onDelete={onDelete} />
    </a>
  );
}
