import { useSyncExternalStore } from 'react';
import { basemapSelector } from '../lib/mapStyle.js';

/** The basemap currently in use; re-renders when the site falls back to another one. */
export function useBasemap() {
  return useSyncExternalStore(basemapSelector.subscribe, basemapSelector.current);
}
