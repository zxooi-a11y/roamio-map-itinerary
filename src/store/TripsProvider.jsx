import { createContext, useContext } from 'react';
import * as cloud from '../lib/cloud.js';
import { tripsReducer } from './tripsReducer.js';
import { useSyncedCollection } from './useSyncedCollection.js';

const TripsContext = createContext(null);

// The generic collection hook loads with { type: 'load', items }; the trips reducer calls that 'trips/load'.
const reducer = (trips, action) => (action.type === 'load' ? tripsReducer(trips, { type: 'trips/load', trips: action.items }) : tripsReducer(trips, action));
const TRIPS = { load: cloud.fetchTrips, save: cloud.saveTrips, remove: cloud.deleteTrips, reducer };

/**
 * Holds every trip. Trips are loaded from the cloud at start-up and every change is saved back in the
 * background (batched, and retried if the connection drops). See useSyncedCollection.
 *
 *   status  'loading' | 'ready' | 'error'   (error: loading failed, see loadError; call reload())
 *   sync    'saved' | 'saving' | 'error'     whether recent edits have reached the cloud
 */
export function TripsProvider({ children }) {
  const { items: trips, dispatch, status, loadError, reload, sync } = useSyncedCollection(TRIPS);
  return (
    <TripsContext.Provider value={{ trips, dispatch, status, loadError, reload, sync }}>
      {children}
    </TripsContext.Provider>
  );
}

export function useTrips() {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error('useTrips must be used inside <TripsProvider>');
  return ctx;
}
