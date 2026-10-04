import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { tripHref } from '../../hooks/useHashRoute.js';
import { useToday } from '../../hooks/useToday.js';
import { plural } from '../../lib/dates.js';
import { sortTrips, tripPhase, tripTitle } from '../../lib/trips.js';
import { useTrips } from '../../store/TripsProvider.jsx';
import { CreateTripDialog } from './CreateTripDialog.jsx';
import { Hero } from './Hero.jsx';
import { PastTripRow, TripCard } from './TripCards.jsx';

export function HomeView({ navigate }) {
  const { trips, dispatch, user, signOut } = useTrips();
  const today = useToday();
  const [creating, setCreating] = useState(false);
  const scroller = useRef(null);

  useEffect(() => { document.title = 'Trip planner'; }, []);

  const sorted = sortTrips(trips, today);
  const past = sorted.filter((t) => tripPhase(t, today) === 'past');
  const comingUp = sorted.filter((t) => ['live', 'upcoming'].includes(tripPhase(t, today))).length;

  const deleteTrip = (trip) => {
    if (confirm(`Delete “${tripTitle(trip)}” and all of its days and stops?`)) dispatch({ type: 'trip/remove', tripId: trip.id });
  };
  const createTrip = (trip) => {
    dispatch({ type: 'trip/add', trip });
    setCreating(false);
    navigate(tripHref(trip.id));
  };
  const scrollBy = (dx) => scroller.current.scrollBy({ left: dx, behavior: 'smooth' });

  return (
    <div className="home-wrap">
      <Hero trips={sorted} today={today} onCreate={() => setCreating(true)} />

      <section aria-labelledby="h-trips">
        <div className="sec-head">
          <div className="sec-title">
            <h2 id="h-trips">Your trips</h2>
            {sorted.length > 0 && <span className="sec-count">{plural(sorted.length, 'trip')} · {comingUp} coming up</span>}
          </div>
          <div className="sc-btns">
            <button className="sc-btn" type="button" aria-label="Scroll trips left" onClick={() => scrollBy(-510)}><Icon name="back" /></button>
            <button className="sc-btn" type="button" aria-label="Scroll trips right" onClick={() => scrollBy(510)}><Icon name="next" /></button>
          </div>
        </div>
        <div className="scroller" ref={scroller} tabIndex={-1}>
          <button className="new-card" type="button" onClick={() => setCreating(true)}>
            <span className="plus"><Icon name="plus" /></span>New trip
          </button>
          {sorted.map((t) => <TripCard key={t.id} trip={t} today={today} onDelete={deleteTrip} />)}
        </div>
      </section>

      <section className="home-sec" aria-labelledby="h-past">
        <div className="sec-head">
          <h2 id="h-past">Past trips</h2>
          {past.length > 0 && <span className="sec-count">{past.length}</span>}
        </div>
        <div className="past-list">
          {past.length
            ? past.map((t) => <PastTripRow key={t.id} trip={t} onDelete={deleteTrip} />)
            : <div className="past-empty">Trips you have finished will show up here.</div>}
        </div>
      </section>

      {user && (
        <footer className="account">
          Signed in as {user.email}
          <button className="ad-link" type="button" onClick={signOut}>Sign out</button>
        </footer>
      )}

      {creating && <CreateTripDialog onClose={() => setCreating(false)} onCreate={createTrip} />}
    </div>
  );
}
