import { useEffect, useSyncExternalStore } from 'react';
import { dayLegs, getRoute, getRoutesVersion, requestLeg, subscribeRoutes } from '../lib/routing.js';
import { legSeconds } from '../lib/timing.js';

/**
 * The legs of some days with their routes (fetching any that aren't cached yet). Returns an array aligned with
 * `days`; each entry is { legs: [{ stop, from, to, mode, key, route }], seconds: [0, t1, t2, ...] } where
 * seconds[i] is the travel time into stop i (guarded: never below what the distance allows, estimated when
 * no route could be found).
 */
export function useDayLegs(days) {
  useSyncExternalStore(subscribeRoutes, getRoutesVersion); // re-render when the cache changes
  const all = days.map((d) => dayLegs(d));
  const signature = all.map((legs) => legs.map((l) => l.key).join(';')).join('\n');

  useEffect(() => {
    all.forEach((legs) => legs.forEach(requestLeg));
    // `signature` captures everything about the days that matters for routing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return all.map((legs) => {
    const withRoutes = legs.map((l) => ({ ...l, route: getRoute(l.key) }));
    return { legs: withRoutes, seconds: [0, ...withRoutes.map((l) => legSeconds(l.from, l.to, l.mode, l.route))] };
  });
}
