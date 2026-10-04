import { useEffect, useSyncExternalStore } from 'react';
import { getRoute, getRoutesVersion, requestRoute, routeKey, subscribeRoutes } from '../lib/routing.js';

/**
 * Road routes for some days (fetching any that aren't cached yet).
 * Returns an array aligned with `days`; an entry is undefined for days with < 2 stops.
 */
export function useRoutes(days) {
  useSyncExternalStore(subscribeRoutes, getRoutesVersion); // re-render when the cache changes
  const keys = days.map(routeKey);
  const signature = keys.join('\n');

  useEffect(() => {
    days.forEach(requestRoute);
    // `signature` captures everything about the days that matters for routing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return keys.map(getRoute);
}

export const useRoute = (day) => useRoutes([day])[0];
