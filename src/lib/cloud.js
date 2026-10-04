import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig.js';
import { normalizeStore } from './trips.js';

/*
 * Trips live in the `trips` table: one row per trip { id, data (the whole trip as JSON), updated_at }.
 * There are no accounts: the site reads and writes the table with the public key, so every device that
 * opens the site sees the same trips.
 */

const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/** An error with a `code` the UI can act on: 'network' | 'unknown'. */
export class CloudError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.code = code;
  }
}

function toCloudError(err, fallbackMessage) {
  const msg = String(err?.message || '');
  if (err instanceof TypeError || /failed to fetch|network|load failed/i.test(msg)) {
    return new CloudError('network', "Couldn't reach the Supabase server.", err);
  }
  return new CloudError('unknown', fallbackMessage + (msg ? ` (${msg})` : ''), err);
}

/** All trips, newest edit first. */
export async function fetchTrips() {
  try {
    const { data, error } = await client.from('trips').select('id, data').order('updated_at', { ascending: false });
    if (error) throw error;
    return normalizeStore({ trips: data.map((row) => ({ ...row.data, id: row.id })) }).trips;
  } catch (err) {
    throw toCloudError(err, "Couldn't load your trips.");
  }
}

/** Create or update these trips. */
export async function saveTrips(trips) {
  if (!trips.length) return;
  const rows = trips.map((t) => ({ id: t.id, data: t, updated_at: new Date(t.updatedAt || Date.now()).toISOString() }));
  try {
    const { error } = await client.from('trips').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  } catch (err) {
    throw toCloudError(err, "Couldn't save your trips.");
  }
}

/** Delete trips by id. */
export async function deleteTrips(ids) {
  if (!ids.length) return;
  try {
    const { error } = await client.from('trips').delete().in('id', ids);
    if (error) throw error;
  } catch (err) {
    throw toCloudError(err, "Couldn't delete your trips.");
  }
}
