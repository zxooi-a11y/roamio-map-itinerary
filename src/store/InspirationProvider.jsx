import { createContext, useContext } from 'react';
import * as cloud from '../lib/cloud.js';
import { normalizePlaces } from '../lib/inspiration.js';
import { inspirationReducer } from './inspirationReducer.js';
import { useSyncedCollection } from './useSyncedCollection.js';

const InspirationContext = createContext(null);

const TABLE = 'inspirations';
const PLACES = {
  load: async () => normalizePlaces(await cloud.fetchRows(TABLE)),
  save: (places) => cloud.saveRows(TABLE, places),
  remove: (ids) => cloud.deleteRows(TABLE, ids),
  reducer: inspirationReducer,
};

/**
 * Places saved for future travels, loaded from and saved to the `inspirations` table in the background.
 * Independent of trips: if this table is missing or unreachable, the rest of the app still works.
 *   { places, dispatch, status: 'loading'|'ready'|'error', loadError, reload, sync }
 */
export function InspirationProvider({ children }) {
  const { items, ...rest } = useSyncedCollection(PLACES);
  return <InspirationContext.Provider value={{ places: items, ...rest }}>{children}</InspirationContext.Provider>;
}

export function useInspiration() {
  const ctx = useContext(InspirationContext);
  if (!ctx) throw new Error('useInspiration must be used inside <InspirationProvider>');
  return ctx;
}
