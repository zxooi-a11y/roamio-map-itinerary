import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal hash router. Hash routing needs no server config, so it works on GitHub Pages.
 *   "#/"                     home
 *   "#/trip/<id>"            a trip
 *   "#/inspiration"          saved places, all countries
 *   "#/inspiration/<key>"    saved places in one country (key: ISO code like "jp", or a typed country name)
 */
export function parseHash(hash) {
  const insp = (hash || '').match(/^#\/inspiration(?:\/(.+))?$/);
  if (insp) {
    try { return { view: 'inspiration', country: insp[1] ? decodeURIComponent(insp[1]) : '' }; }
    catch { return { view: 'inspiration', country: '' }; }
  }
  const m = (hash || '').match(/^#\/trip\/(.+)$/);
  if (!m) return { view: 'home' };
  try {
    return { view: 'trip', tripId: decodeURIComponent(m[1]) };
  } catch {
    return { view: 'home' };
  }
}

export const tripHref = (tripId) => '#/trip/' + encodeURIComponent(tripId);
export const inspirationHref = (countryKey = '') => '#/inspiration' + (countryKey ? '/' + encodeURIComponent(countryKey) : '');

export function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  /** Go somewhere; with replace, don't leave a history entry (used for dead links). */
  const navigate = useCallback((hash, { replace = false } = {}) => {
    if (replace) history.replaceState(null, '', hash);
    else if (location.hash !== hash) history.pushState(null, '', hash);
    setRoute(parseHash(hash));
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(parseHash(location.hash));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return [route, navigate];
}
