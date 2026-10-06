import { createContext, useContext, useMemo } from 'react';
import * as cloud from '../lib/cloud.js';
import { normalizeItems, splitItems } from '../lib/inspiration.js';
import { inspirationReducer } from './inspirationReducer.js';
import { useSyncedCollection } from './useSyncedCollection.js';

const InspirationContext = createContext(null);

const TABLE = 'inspirations';
const PLACES = {
  load: async () => normalizeItems(await cloud.fetchRows(TABLE)),
  save: (places) => cloud.saveRows(TABLE, places),
  remove: (ids) => cloud.deleteRows(TABLE, ids),
  reducer: inspirationReducer,
};

/**
 * Places saved for future travels, and the folders they're filed in, loaded from and saved to the
 * `inspirations` table in the background (one table holds both; see inspirationReducer for the actions).
 * Independent of trips: if this table is missing or unreachable, the rest of the app still works.
 *   { places, folders, dispatch, status: 'loading'|'ready'|'error', loadError, reload, sync }
 */
export function InspirationProvider({ children }) {
  const { items, ...rest } = useSyncedCollection(PLACES);
  const { places, folders } = useMemo(() => splitItems(items), [items]);
  return <InspirationContext.Provider value={{ places, folders, ...rest }}>{children}</InspirationContext.Provider>;
}

export function useInspiration() {
  const ctx = useContext(InspirationContext);
  if (!ctx) throw new Error('useInspiration must be used inside <InspirationProvider>');
  return ctx;
}
