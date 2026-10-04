import { normalizeStore } from './trips.js';

const STORE_KEY = 'itinerary-trips-v1'; // same key as the original draft, so existing trips carry over

export function loadTrips() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalizeStore(JSON.parse(raw)).trips;
  } catch {
    /* unreadable or blocked storage: start empty */
  }
  return [];
}

/** Returns false when the browser refused to save (usually: storage full). */
export function saveTrips(trips) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ trips }));
    return true;
  } catch {
    return false;
  }
}
