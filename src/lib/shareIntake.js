import { parseLink } from './inspiration.js';

/*
 * Getting a link INTO the app from outside it (Instagram's share menu, an iPhone shortcut, a bookmark):
 * the site is opened as  <site>/?link=<instagram link>  (the Android share menu sends ?url=…&text=… instead,
 * see public/manifest.webmanifest). We pick the first link out of those parameters, take the query string off
 * the address bar, and open the Inspiration page's Save dialog with the link filled in.
 */

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i;

/** The first http(s) link inside some text ("Look at this https://… so good!" → the link), or ''. */
export function extractUrl(text) {
  const m = String(text || '').match(URL_IN_TEXT);
  return m ? m[0].replace(/[)\]}.,;:!?'"]+$/, '') : '';
}

/**
 * The link a URL query string is carrying, cleaned up by parseLink, or ''.
 * Looks in `link`, then `url`, then `text`, then `title` (apps differ in where they put it).
 */
export function linkFromParams(search) {
  const params = new URLSearchParams(search || '');
  // A bare "instagram.com/p/…" is fine in our own `link` parameter
  const direct = parseLink(params.get('link'));
  if (direct) return direct.url;
  for (const key of ['link', 'url', 'text', 'title']) {
    const found = parseLink(extractUrl(params.get(key)));
    if (found) return found.url;
  }
  return '';
}

let pending = '';

/**
 * Call once at start-up, before the router reads the address. If the page was opened with a shared link,
 * remember it, clear the query string and point the address at the Inspiration page. Returns true if it did.
 */
export function captureSharedLink(loc = window.location, hist = window.history) {
  const link = linkFromParams(loc.search);
  if (!link) return false;
  pending = link;
  hist.replaceState(null, '', loc.pathname + '#/inspiration');
  return true;
}

/** The captured link (once); the Inspiration page uses it to open the Save dialog. */
export function takeSharedLink() {
  const link = pending;
  pending = '';
  return link;
}

/** The address to give shortcuts / bookmarks: this site's front page plus "?link=". */
export const shareBaseUrl = (loc = window.location) => loc.origin + loc.pathname.replace(/[^/]*$/, '') + '?link=';
