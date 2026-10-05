import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig.js';
import { normalizeStore } from './trips.js';

/*
 * Each kind of data has its own table with one row per item { id, data (the item as JSON), updated_at }:
 *   trips          the itineraries                  (supabase/trips.sql)
 *   inspirations   places saved for future travels  (supabase/inspirations.sql)
 * There are no accounts: the site reads and writes the tables with the public key, so every device that
 * opens the site sees the same data.
 */

const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/** An error with a `code` the UI can act on: 'network' | 'missing_table' | 'unknown'. */
export class CloudError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.code = code;
  }
}

function toCloudError(err, fallbackMessage) {
  const msg = String(err?.message || '');
  // The table hasn't been created in Supabase yet (see the supabase/*.sql files)
  if (err?.code === 'PGRST205' || err?.code === '42P01' || /could not find the table|relation .* does not exist/i.test(msg)) {
    return new CloudError('missing_table', "This part of the database hasn't been set up yet.", err);
  }
  if (err instanceof TypeError || /failed to fetch|network|load failed/i.test(msg)) {
    return new CloudError('network', "Couldn't reach the Supabase server.", err);
  }
  return new CloudError('unknown', fallbackMessage + (msg ? ` (${msg})` : ''), err);
}

/* ---------- Generic: one row per item { id, data, updated_at } ---------- */

/** All rows of a table as items, newest edit first. */
export async function fetchRows(table) {
  try {
    const { data, error } = await client.from(table).select('id, data').order('updated_at', { ascending: false });
    if (error) throw error;
    return data.map((row) => ({ ...row.data, id: row.id }));
  } catch (err) {
    throw toCloudError(err, "Couldn't load your data.");
  }
}

/** Create or update these items. */
export async function saveRows(table, items) {
  if (!items.length) return;
  const rows = items.map((t) => ({ id: t.id, data: t, updated_at: new Date(t.updatedAt || Date.now()).toISOString() }));
  try {
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  } catch (err) {
    throw toCloudError(err, "Couldn't save your changes.");
  }
}

/** Delete items by id. */
export async function deleteRows(table, ids) {
  if (!ids.length) return;
  try {
    const { error } = await client.from(table).delete().in('id', ids);
    if (error) throw error;
  } catch (err) {
    throw toCloudError(err, "Couldn't delete.");
  }
}

/* ---------- Trips ---------- */

/** All trips, newest edit first, repaired so the UI can trust their shape. */
export const fetchTrips = async () => normalizeStore({ trips: await fetchRows('trips') }).trips;
export const saveTrips = (trips) => saveRows('trips', trips);
export const deleteTrips = (ids) => deleteRows('trips', ids);
