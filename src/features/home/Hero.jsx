import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { MapSnapshot } from '../../components/MapSnapshot.jsx';
import { useCountdown } from '../../hooks/useCountdown.js';
import { tripHref } from '../../hooks/useHashRoute.js';
import { parseYmd } from '../../lib/dates.js';
import { fetchDestinationPhoto } from '../../lib/photos.js';
import { badgeText, liveDayIndex, nextTrip, summaryLine, tripPhase, tripRange, tripTitle } from '../../lib/trips.js';
import { useTrips } from '../../store/TripsProvider.jsx';

/** The big banner on the home page: a countdown to the next trip, or a prompt to plan one. */
export function Hero({ trips, today, onCreate }) {
  const trip = nextTrip(trips, today);
  const createBtn = (
    <button className="hero-create" type="button" onClick={onCreate}>
      <Icon name="plus" />Create trip
    </button>
  );

  if (!trip) return <EmptyHero trips={trips} today={today} createBtn={createBtn} />;

  const live = tripPhase(trip, today) === 'live';
  return (
    <section className="hero" aria-label="Next trip">
      <HeroBackground trip={trip} />
      <div className="hero-top">
        <span className="hero-pill">{live ? 'Happening now' : 'Next trip'}</span>
        {createBtn}
      </div>
      <div className="hero-bottom">
        <h1 className="hero-title">{tripTitle(trip)}</h1>
        <p className="hero-meta">{summaryLine(trip, { withStops: false })}</p>
        <div className="hero-row">
          {live ? <LiveDay trip={trip} today={today} /> : <Countdown trip={trip} today={today} />}
          <a className="hero-open" href={tripHref(trip.id)}>Open itinerary<Icon name="next" /></a>
        </div>
      </div>
    </section>
  );
}

function EmptyHero({ trips, today, createBtn }) {
  const planning = trips
    .filter((t) => tripPhase(t, today) === 'planning')
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  const message = planning
    ? `Add dates to “${planning.title || 'your trip'}” to start a countdown.`
    : trips.length ? 'Nothing coming up. Plan your next adventure.' : 'Plan your first trip and the countdown starts here.';
  return (
    <section className="hero hero-plain" aria-label="Next trip">
      <div className="hero-top">
        <span className="hero-pill">Trip planner</span>
        {createBtn}
      </div>
      <div className="hero-bottom">
        <h1 className="hero-title">Where to next?</h1>
        <p className="hero-meta">{message}</p>
        {planning && (
          <div className="hero-row">
            <a className="hero-open" href={tripHref(planning.id)}>Open itinerary<Icon name="next" /></a>
          </div>
        )}
      </div>
    </section>
  );
}

/** Map snapshot behind the hero, with a Wikipedia photo faded in on top when one is found. */
function HeroBackground({ trip }) {
  const { dispatch } = useTrips();
  const [loaded, setLoaded] = useState(false);
  const points = trip.days.flatMap((d) => d.stops);

  // Look up a destination photo once per trip and remember the result on the trip.
  useEffect(() => {
    if (trip.photo || trip.photoTried) return;
    let cancelled = false;
    fetchDestinationPhoto(trip)
      .then((photo) => { if (!cancelled) dispatch({ type: 'trip/setPhoto', tripId: trip.id, photo }); })
      .catch(() => { /* offline: keep the map and try again next visit */ });
    return () => { cancelled = true; };
    // Only re-run for a different trip or once the photo state changes, not on every edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, trip.photo, trip.photoTried, dispatch]);

  useEffect(() => setLoaded(false), [trip.photo]);

  return (
    <>
      <div className="hero-bg">
        <MapSnapshot points={points} center={trip.center} w={1040} h={360} />
        {trip.photo && (
          <img className={'hero-img' + (loaded ? ' in' : '')} alt="" src={trip.photo}
            onLoad={() => setLoaded(true)} onError={(e) => { e.currentTarget.hidden = true; }} />
        )}
      </div>
      {loaded && <span className="hero-credit">Photo: Wikipedia</span>}
    </>
  );
}

function LiveDay({ trip, today }) {
  const idx = liveDayIndex(trip, today);
  const day = trip.days[idx];
  return (
    <div className="hero-live">
      <strong>Day {idx + 1} of {trip.days.length}</strong>
      <span>{day?.title || 'Enjoy the trip'}</span>
    </div>
  );
}

const UNITS = ['Days', 'Hours', 'Min', 'Sec'];

function Countdown({ trip, today }) {
  const parts = useCountdown(parseYmd(tripRange(trip).start).getTime()) || [0, 0, 0, 0];
  return (
    <>
      <span className="sr-only">{badgeText(trip, today)} until {tripTitle(trip)}</span>
      <div className="hero-count" aria-hidden="true">
        {UNITS.map((label, i) => (
          <div className="cd-tile" key={label}>
            <span className="cd-num">{i ? String(parts[i]).padStart(2, '0') : parts[i]}</span>
            <span className="cd-lbl">{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
