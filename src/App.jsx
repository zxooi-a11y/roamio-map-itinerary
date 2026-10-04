import { useEffect } from 'react';
import { HomeView } from './features/home/HomeView.jsx';
import { TripView } from './features/trip/TripView.jsx';
import { useHashRoute } from './hooks/useHashRoute.js';
import { useTrips } from './store/TripsProvider.jsx';

/** Picks the view from the URL hash: "#/" → home, "#/trip/<id>" → that trip's planner. */
export function App() {
  const { status } = useTrips();
  if (status === 'loading') return <Splash message="Loading your trips…" />;
  if (status === 'error') return <LoadError />;
  return <Routes />;
}

function Routes() {
  const [route, navigate] = useHashRoute();
  const { trips, sync } = useTrips();
  const trip = route.view === 'trip' ? trips.find((t) => t.id === route.tripId) : null;
  const deadLink = route.view === 'trip' && !trip;

  // A link to a trip that no longer exists goes back home.
  useEffect(() => {
    if (deadLink) navigate('#/', { replace: true });
  }, [deadLink, navigate]);

  return (
    <>
      {trip ? <TripView key={trip.id} trip={trip} /> : <HomeView navigate={navigate} />}
      {sync !== 'saved' && (
        <div className={'sync-badge' + (sync === 'error' ? ' is-error' : '')} role="status">
          {sync === 'error' ? 'Not saved yet. Retrying…' : 'Saving…'}
        </div>
      )}
    </>
  );
}

function Splash({ message, children }) {
  return (
    <div className="splash" role="status">
      <p>{message}</p>
      {children}
    </div>
  );
}

function LoadError() {
  const { loadError, reload } = useTrips();
  const messages = {
    anon_disabled: 'Anonymous sign-ins are turned off in your Supabase project. Turn on "Allow anonymous sign-ins" under Authentication → Sign In / Providers, then try again.',
    network: "Couldn't reach the server. Check your connection and try again.",
  };
  return (
    <Splash message="Your trips couldn't be loaded.">
      <p className="splash-detail">{messages[loadError?.code] || loadError?.message || 'Something went wrong.'}</p>
      <button className="btn" type="button" onClick={reload}>Try again</button>
    </Splash>
  );
}
