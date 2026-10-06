import { useEffect } from 'react';
import { HomeView } from './features/home/HomeView.jsx';
import { InspirationView } from './features/inspiration/InspirationView.jsx';
import { TripView } from './features/trip/TripView.jsx';
import { useHashRoute } from './hooks/useHashRoute.js';
import { useInspiration } from './store/InspirationProvider.jsx';
import { useTrips } from './store/TripsProvider.jsx';

/** Picks the view from the URL hash: home, a trip's planner, or the Inspiration page (see useHashRoute). */
export function App() {
  const { status } = useTrips();
  if (status === 'loading') return <Splash message="Loading your trips…" />;
  if (status === 'error') return <LoadError />;
  return <Routes />;
}

function Routes() {
  const [route, navigate] = useHashRoute();
  const { trips, sync: tripsSync } = useTrips();
  const { sync: placesSync } = useInspiration();
  // One badge for everything that saves in the background
  const sync = tripsSync === 'error' || placesSync === 'error' ? 'error' : tripsSync === 'saving' || placesSync === 'saving' ? 'saving' : 'saved';
  const trip = route.view === 'trip' ? trips.find((t) => t.id === route.tripId) : null;
  const deadLink = route.view === 'trip' && !trip;

  // A link to a trip that no longer exists goes back home.
  useEffect(() => {
    if (deadLink) navigate('#/', { replace: true });
  }, [deadLink, navigate]);

  return (
    <>
      {trip ? <TripView key={trip.id} trip={trip} />
        : route.view === 'inspiration' ? <InspirationView country={route.country} folder={route.folder} navigate={navigate} />
        : <HomeView navigate={navigate} />}
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
    network: "Couldn't reach the server. Check your connection and try again.",
  };
  return (
    <Splash message="Your trips couldn't be loaded.">
      <p className="splash-detail">{messages[loadError?.code] || loadError?.message || 'Something went wrong.'}</p>
      <button className="btn" type="button" onClick={reload}>Try again</button>
    </Splash>
  );
}
