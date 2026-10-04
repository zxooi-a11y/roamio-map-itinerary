import { useEffect } from 'react';
import { HomeView } from './features/home/HomeView.jsx';
import { TripView } from './features/trip/TripView.jsx';
import { useHashRoute } from './hooks/useHashRoute.js';
import { useTrips } from './store/TripsProvider.jsx';

/** Picks the view from the URL hash: "#/" → home, "#/trip/<id>" → that trip's planner. */
export function App() {
  const [route, navigate] = useHashRoute();
  const { trips } = useTrips();
  const trip = route.view === 'trip' ? trips.find((t) => t.id === route.tripId) : null;
  const deadLink = route.view === 'trip' && !trip;

  // A link to a trip that no longer exists goes back home.
  useEffect(() => {
    if (deadLink) navigate('#/', { replace: true });
  }, [deadLink, navigate]);

  return trip
    ? <TripView key={trip.id} trip={trip} />
    : <HomeView navigate={navigate} />;
}
