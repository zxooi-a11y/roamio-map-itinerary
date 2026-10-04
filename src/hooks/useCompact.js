import { useSyncExternalStore } from 'react';

/** Screens up to this width get the streamlined itinerary layout (phones). */
export const COMPACT_QUERY = '(max-width: 560px)';

const subscribe = (fn) => {
  const mq = window.matchMedia(COMPACT_QUERY);
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
};
const snapshot = () => window.matchMedia(COMPACT_QUERY).matches;

/** True on phone-sized screens; follows rotation and window resizes. */
export function useCompact() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
