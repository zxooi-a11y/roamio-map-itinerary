import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig.js';
import { normalizeStore } from './trips.js';

/*
 * Trips live in the `trips` table: one row per trip { user_id, id, data (the whole trip as JSON), updated_at }.
 * You sign in once per browser with email + password and Supabase keeps the session (in localStorage),
 * so any device you've signed in on shows the same trips. Row-level security means an account can only
 * ever see its own rows.
 */

const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** An error with a `code` the UI can act on: 'signed_out' | 'bad_credentials' | 'network' | 'unknown'. */
export class CloudError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.code = code;
  }
}

function toCloudError(err, fallbackMessage) {
  if (err instanceof CloudError) return err;
  const msg = String(err?.message || '');
  if (err?.code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    return new CloudError('bad_credentials', 'That email and password don’t match.', err);
  }
  if (err?.code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
    return new CloudError('unconfirmed', 'Please confirm your email first. Check your inbox for the link.', err);
  }
  if (err?.code === 'user_already_exists' || /already registered/i.test(msg)) {
    return new CloudError('exists', 'That email already has an account. Try signing in instead.', err);
  }
  if (err?.code === 'weak_password') {
    return new CloudError('weak_password', 'Please choose a longer password (at least 6 characters).', err);
  }
  if (err?.code === 'signup_disabled' || /signups? (not allowed|disabled)/i.test(msg)) {
    return new CloudError('signup_disabled', 'New accounts are turned off. Sign in with your existing account.', err);
  }
  if (err?.status === 429 || err?.code === 'over_email_send_rate_limit') {
    return new CloudError('rate_limited', 'Too many attempts. Please wait a minute and try again.', err);
  }
  if (err instanceof TypeError || /failed to fetch|network|load failed/i.test(msg)) {
    return new CloudError('network', "Couldn't reach the Supabase server.", err);
  }
  return new CloudError('unknown', fallbackMessage + (msg ? ` (${msg})` : ''), err);
}

/* ---------- Accounts ---------- */

/** The signed-in user ({ id, email }) or null. Resumes this browser's saved session. */
export async function getUser() {
  try {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session?.user ?? null;
  } catch (err) {
    throw toCloudError(err, "Couldn't check your sign-in.");
  }
}

export async function signIn(email, password) {
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  } catch (err) {
    throw toCloudError(err, "Couldn't sign you in.");
  }
}

/** Create an account. Returns { user } when signed in straight away, or { needsConfirmation: true }. */
export async function signUp(email, password) {
  try {
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    // With email confirmation on there's no session yet; with it off we're signed in immediately.
    if (!data.session) return { needsConfirmation: true };
    return { user: data.user };
  } catch (err) {
    throw toCloudError(err, "Couldn't create your account.");
  }
}

export async function signOut() {
  try {
    await client.auth.signOut();
  } catch (err) {
    throw toCloudError(err, "Couldn't sign you out.");
  }
}

/** Call fn(user | null) whenever this browser signs in or out (including from another tab). Returns an unsubscribe. */
export function onAuthChange(fn) {
  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') fn(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

/* ---------- Trips ---------- */

async function requireUser() {
  const user = await getUser();
  if (!user) throw new CloudError('signed_out', 'You are signed out.');
  return user;
}

/** All of this account's trips, newest edit first. */
export async function fetchTrips() {
  await requireUser();
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
  await requireUser();
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
  await requireUser();
  try {
    const { error } = await client.from('trips').delete().in('id', ids);
    if (error) throw error;
  } catch (err) {
    throw toCloudError(err, "Couldn't delete your trips.");
  }
}
