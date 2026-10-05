import { useCallback, useEffect, useRef, useState } from 'react';
import { searchPlaces } from '../lib/geocode.js';

const DEBOUNCE_MS = 550;
const MIN_CHARS = 3;

/**
 * Debounced place search shared by the "Add stop" and "Create trip" dialogs.
 * Older requests are aborted, so results never arrive out of order.
 *
 * status: 'idle' | 'short' | 'searching' | 'done' | 'error'
 */
export function usePlaceSearch({ limit = 6, getViewbox, countryCodes } = {}) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ status: 'idle', results: [], q: '' });
  const ctlRef = useRef(null);
  const timerRef = useRef(0);
  const viewboxRef = useRef(getViewbox);
  viewboxRef.current = getViewbox;
  const countryRef = useRef(countryCodes); // optional: only search in these countries, e.g. "jp"
  countryRef.current = countryCodes;

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    ctlRef.current?.abort();
    ctlRef.current = null;
  }, []);

  const run = useCallback(async (q) => {
    cancel();
    const ctl = new AbortController();
    ctlRef.current = ctl;
    setState({ status: 'searching', results: [], q });
    try {
      const results = await searchPlaces(q, { limit, viewbox: viewboxRef.current?.(), countryCodes: countryRef.current || undefined, signal: ctl.signal });
      if (!ctl.signal.aborted) setState({ status: 'done', results, q });
    } catch {
      if (!ctl.signal.aborted) setState({ status: 'error', results: [], q });
    }
  }, [cancel, limit]);

  /** Update the query; searches after a short pause. */
  const onQueryChange = useCallback((value) => {
    setQuery(value);
    cancel();
    const q = value.trim();
    if (q.length < MIN_CHARS) {
      setState({ status: q ? 'short' : 'idle', results: [], q });
      return;
    }
    setState((s) => ({ ...s, status: 'searching' }));
    timerRef.current = setTimeout(() => run(q), DEBOUNCE_MS);
  }, [cancel, run]);

  /** Search right away (Enter key). */
  const searchNow = useCallback(() => {
    const q = query.trim();
    if (q.length >= 2) run(q);
  }, [query, run]);

  const reset = useCallback((value = '') => {
    cancel();
    setQuery(value);
    setState({ status: 'idle', results: [], q: '' });
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { query, onQueryChange, searchNow, reset, ...state };
}
