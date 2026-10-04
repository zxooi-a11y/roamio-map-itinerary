import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig.js';
import { normalizeStore } from './trips.js';

/*
 * Trips live in the `trips` table: one row per trip { user_id, id, data (the whole trip as JSON), updated_at }.
 * Nobody signs in with a password: the browser quietly gets its own anonymous Supabase account, kept in
 * localStorage. Row-level security means that account can only see its own trips.
 */

const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** An error with a `code` the UI can act on: 'anon_disabled' | 'network' | 'unknown'. */
export class CloudError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.code = code;
  }
}

function toCloudError(err, fallbackMessage) {
  if (err instanceof CloudError) return err;
  const msg = String(err?.message || '');
  if (err?.code === 'anonymous_provider_disabled' || /anonymous sign-ins are disabled/i.test(msg)) {
    return new CloudError('anon_disabled', 'Anonymous sign-ins are turned off in Supabase.', err);
  }
  if (err instanceof TypeError || /failed to fetch|network|load failed/i.test(msg)) {
    return new CloudError('network', "Couldn't reach the Supabase server.", err);
  }
  return new CloudError('unknown', fallbackMessage + (msg ? ` (${msg})` : ''), err);
}

let sessionPromise = null;

/** Resume this browser's account, or create one the first time. Safe to call repeatedly. */
export function ensureSession() {
  sessionPromise ??= (async () => {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session) return data.session.user;
      const created = await client.auth.signInAnonymously();
      if (created.error) throw created.error;
      return created.data.user;
    } catch (err) {
      sessionPromise = null; // allow a retry
      throw toCloudError(err, "Couldn't start a session.");
    }
  })();
  return sessionPromise;
}

/** All of this account's trips, newest edit first. */
export async function fetchTrips() {
  await ensureSession();
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
  await ensureSession();
  const rows = trips.map((t) => ({ id: t.id, data: t, updated_at: new Date(t.updatedAt || Date.now()).toISOString() }));
  try {
    const { error } = await client.from('trips').upsert(rows, { onConflict: 'user_id,id' });
    if (error) throw error;
  } catch (err) {
    throw toCloudError(err, "Couldn't save your trips.");
  }
}

/** Delete trips by id. */
export async function deleteTrips(ids) {
  if (!ids.length) return;
  await ensureSession();
  try {
    const { error } = await client.from('trips').delete().in('id', ids);
    if (error) throw error;
  } catch (err) {
    throw toCloudError(err, "Couldn't delete your trips.");
  }
}
