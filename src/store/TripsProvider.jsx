import { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { loadTrips, saveTrips } from '../lib/storage.js';
import { tripsReducer } from './tripsReducer.js';
import { useToast } from '../components/Toast.jsx';

const TripsContext = createContext(null);

/** Holds every trip, and saves to localStorage after each change. */
export function TripsProvider({ children }) {
  const [trips, dispatch] = useReducer(tripsReducer, undefined, loadTrips);
  const toast = useToast();
  const warned = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const ok = saveTrips(trips);
    if (!ok && !warned.current) {
      warned.current = true;
      toast('Your browser storage is full, so recent changes may not be saved. Try removing some day photos.');
    }
    if (ok) warned.current = false;
  }, [trips, toast]);

  return <TripsContext.Provider value={{ trips, dispatch }}>{children}</TripsContext.Provider>;
}

export function useTrips() {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error('useTrips must be used inside <TripsProvider>');
  return ctx;
}
