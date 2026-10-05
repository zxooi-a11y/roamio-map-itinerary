import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useToast } from '../components/Toast.jsx';
import { diffTrips as diffById } from './diffTrips.js';

const SAVE_DELAY_MS = 800;  // wait for a pause in editing before saving
const RETRY_DELAY_MS = 5000;

/**
 * A list of items (each with an `id`) that lives in a cloud table: loaded at start-up, and every change made
 * through `dispatch` is saved back in the background, batched, and retried if the connection drops.
 *
 *   load()        -> Promise<items>       fetch everything
 *   save(items)   -> Promise              create / update these items
 *   remove(ids)   -> Promise              delete these items
 *   reducer       (items, action) -> items, must never mutate; it must handle { type: 'load', items }
 *
 * Returns { items, dispatch, status, loadError, reload, sync }
 *   status  'loading' | 'ready' | 'error'    (error: loading failed, see loadError; call reload())
 *   sync    'saved' | 'saving' | 'error'     whether recent edits have reached the cloud
 */
export function useSyncedCollection({ load, save, remove, reducer }) {
  const [items, dispatch] = useReducer(reducer, []);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [sync, setSync] = useState('saved');
  const toast = useToast();

  const api = useRef({ load, save, remove });
  api.current = { load, save, remove };
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const known = useRef(new Map()); // items as of the last diff
  const pending = useRef({ upserts: new Set(), deletes: new Set() });
  const timer = useRef(0);
  const flushing = useRef(false);
  const warned = useRef(false);

  /* ---------- load ---------- */
  const reload = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const loaded = await api.current.load();
      known.current = new Map(loaded.map((t) => [t.id, t]));
      pending.current = { upserts: new Set(), deletes: new Set() };
      dispatch({ type: 'load', items: loaded });
      setSync('saved');
      setStatus('ready');
    } catch (err) {
      setLoadError(err);
      setStatus('error');
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /* ---------- save ---------- */
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (flushing.current) { timer.current = setTimeout(flush, SAVE_DELAY_MS); return; }
    const { upserts, deletes } = pending.current;
    if (!upserts.size && !deletes.size) { setSync('saved'); return; }

    // Take the work; anything edited from now on is queued separately.
    const takenUpserts = [...upserts], takenDeletes = [...deletes];
    pending.current = { upserts: new Set(), deletes: new Set() };
    const byId = new Map(itemsRef.current.map((t) => [t.id, t]));
    const toSave = takenUpserts.map((id) => byId.get(id)).filter(Boolean);

    flushing.current = true;
    try {
      await api.current.save(toSave);
      await api.current.remove(takenDeletes);
      warned.current = false;
      if (!pending.current.upserts.size && !pending.current.deletes.size) setSync('saved');
      else timer.current = setTimeout(flush, SAVE_DELAY_MS);
    } catch (err) {
      // Put the work back and try again shortly.
      takenUpserts.forEach((id) => pending.current.upserts.add(id));
      takenDeletes.forEach((id) => pending.current.deletes.add(id));
      setSync('error');
      if (!warned.current) {
        warned.current = true;
        toast(err.code === 'network'
          ? "You seem to be offline. Your changes will be saved when you're back online."
          : "Couldn't save your changes. Retrying…");
      }
      timer.current = setTimeout(flush, RETRY_DELAY_MS);
    } finally {
      flushing.current = false;
    }
  }, [toast]);

  // Queue whatever changed since the last render.
  useEffect(() => {
    if (status !== 'ready') return;
    const { upserts, deletes, next } = diffById(known.current, items);
    known.current = next;
    if (!upserts.length && !deletes.length) return;
    upserts.forEach((id) => { pending.current.upserts.add(id); pending.current.deletes.delete(id); });
    deletes.forEach((id) => { pending.current.deletes.add(id); pending.current.upserts.delete(id); });
    setSync('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [items, status, flush]);

  // Don't wait for the timer when the tab is hidden or closed, and retry as soon as we're back online.
  useEffect(() => {
    const flushNow = () => { if (pending.current.upserts.size || pending.current.deletes.size) flush(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushNow(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('online', flushNow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushNow);
      window.removeEventListener('online', flushNow);
      clearTimeout(timer.current);
    };
  }, [flush]);

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (sync === 'saved') return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [sync]);

  return { items, dispatch, status, loadError, reload, sync };
}
