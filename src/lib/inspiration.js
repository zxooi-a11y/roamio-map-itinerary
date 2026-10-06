import { CATEGORIES, guessCategory } from './categories.js';
import { newId } from './ids.js';

/*
 * Inspiration: places saved for future travels, usually from an Instagram post.
 *
 * Place { id, name, address, city, country, countryCode, lat, lng, cat, link, note, needsPlace, createdAt, updatedAt }
 *   country / countryCode   from the place search (countryCode is the ISO "jp", used to group), or typed in
 *   lat / lng               null when the place was typed in rather than found
 *   link                    the Instagram post / reel (or any other link), cleaned up by parseLink
 */

/* ---------- Links ---------- */

const IG_HOSTS = /^(www\.|m\.)?(instagram\.com|instagr\.am)$/i;
const TIKTOK_HOSTS = /^(www\.|m\.|vm\.|vt\.)?tiktok\.com$/i;

/**
 * Tidy a pasted link. Instagram / TikTok share links lose their tracking bits (?igsh=, ?utm_...).
 * Returns { url, kind: 'instagram'|'tiktok'|'other', label } or null if it isn't a web link.
 */
export function parseLink(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s) && /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;

  if (IG_HOSTS.test(u.hostname)) {
    const parts = u.pathname.split('/').filter(Boolean);
    const url = 'https://www.instagram.com/' + (parts.length ? parts.join('/') + '/' : '');
    const kinds = { p: 'Instagram post', reel: 'Instagram reel', reels: 'Instagram reel', tv: 'Instagram video', stories: 'Instagram story' };
    const label = kinds[parts[0]] || (parts.length === 1 ? '@' + parts[0] : 'Instagram');
    return { url, kind: 'instagram', label };
  }
  if (TIKTOK_HOSTS.test(u.hostname)) {
    return { url: 'https://' + u.hostname + u.pathname, kind: 'tiktok', label: 'TikTok' };
  }
  return { url: u.href, kind: 'other', label: u.hostname.replace(/^www\./, '') };
}

/* ---------- Countries ---------- */

/** 🇯🇵 from "jp"; '' if not a two-letter code. */
export function flagEmoji(code) {
  if (!code || !/^[a-z]{2}$/i.test(code)) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

let regionNames = null;
/** "Japan" for "jp" in the reader's language, falling back to the stored name. */
export function countryName(place) {
  if (place.countryCode) {
    try {
      regionNames ??= new Intl.DisplayNames(undefined, { type: 'region' });
      const n = regionNames.of(place.countryCode.toUpperCase());
      if (n) return n;
    } catch { /* old browser */ }
  }
  return place.country || '';
}

/** The key places are grouped by: the ISO code when known, else the typed country, else '' (no country). */
export const countryKey = (place) => (place.countryCode ? place.countryCode.toLowerCase() : (place.country || '').trim().toLowerCase());

/**
 * Places grouped by country: [{ key, name, flag, places }], countries A–Z, places newest first.
 * Places without a country come last, under "No country".
 */
export function groupByCountry(places) {
  const groups = new Map();
  for (const p of places) {
    const key = countryKey(p);
    if (!groups.has(key)) groups.set(key, { key, name: key ? countryName(p) : 'No country', flag: flagEmoji(p.countryCode), places: [] });
    groups.get(key).places.push(p);
  }
  const list = [...groups.values()];
  list.forEach((g) => g.places.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  return list.sort((a, b) => (!a.key) - (!b.key) || a.name.localeCompare(b.name));
}

/* ---------- Search, links out ---------- */

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Places matching every word of the query in their name, city, country, address or note (accents ignored). */
export function searchPlacesList(places, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return places;
  return places.filter((p) => {
    const hay = fold([p.name, p.city, p.address, p.note, p.country, countryName(p)].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

/** A Google Maps link for the place: exact coordinates when known, otherwise a search for its name. */
export function mapsUrl(p) {
  const q = p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : [p.name, p.city, countryName(p)].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

/* ---------- Creating / repairing ---------- */

export function makePlace(fields) {
  const now = Date.now();
  return normalizePlace({ ...fields, id: newId(), createdAt: now, updatedAt: now });
}

/** Repair anything missing or malformed so the UI can trust a place's shape. Returns null for junk. */
export function normalizePlace(p) {
  if (!p || typeof p !== 'object') return null;
  const name = String(p.name || '').trim();
  if (!name) return null;
  const num = (v) => (v === null || v === undefined || v === '' || !isFinite(v) ? null : Number(v));
  let lat = num(p.lat), lng = num(p.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) lat = lng = null;
  return {
    id: p.id || newId(),
    name,
    address: String(p.address || ''),
    city: String(p.city || ''),
    country: String(p.country || '').trim(),
    countryCode: /^[a-z]{2}$/i.test(p.countryCode || '') ? p.countryCode.toLowerCase() : '',
    lat, lng,
    cat: CATEGORIES.includes(p.cat) ? p.cat : guessCategory(name),
    link: p.link ? (parseLink(p.link)?.url || '') : '',
    note: String(p.note || ''),
    needsPlace: Boolean(p.needsPlace),
    folderId: String(p.folderId || ''),
    createdAt: Number(p.createdAt) || 0,
    updatedAt: Number(p.updatedAt) || 0,
  };
}

export const normalizePlaces = (list) => (Array.isArray(list) ? list.map(normalizePlace).filter(Boolean) : []);

/* ---------- Folders ---------- */

export const FOLDER_NAME_MAX = 60;
export const isFolder = (item) => item?.kind === 'folder';

/** A folder, or null if it has no name. */
export function normalizeFolder(f) {
  if (!f || typeof f !== 'object') return null;
  const name = String(f.name || '').replace(/\s+/g, ' ').trim().slice(0, FOLDER_NAME_MAX);
  if (!name) return null;
  return { id: f.id || newId(), kind: 'folder', name, createdAt: Number(f.createdAt) || 0, updatedAt: Number(f.updatedAt) || 0 };
}

export function makeFolder(name) {
  const now = Date.now();
  return normalizeFolder({ id: newId(), name, createdAt: now, updatedAt: now });
}

/** Everything stored in the table (places and folders), repaired; junk is dropped. */
export const normalizeItems = (list) => (Array.isArray(list) ? list.map((x) => (isFolder(x) ? normalizeFolder(x) : normalizePlace(x))).filter(Boolean) : []);

/** The stored items split into { places, folders } (folders A–Z). */
export function splitItems(items) {
  const places = [], folders = [];
  for (const it of items) (isFolder(it) ? folders : places).push(it);
  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return { places, folders };
}

/** Is there already a folder with this name (ignoring case and spacing)? `exceptId` skips the one being renamed. */
export function folderNameTaken(folders, name, exceptId = '') {
  const key = String(name).replace(/\s+/g, ' ').trim().toLowerCase();
  return folders.some((f) => f.id !== exceptId && f.name.toLowerCase() === key);
}

/** The folder a place is in, or undefined (also when its folder has since been deleted). */
export const folderOf = (place, folders) => (place.folderId ? folders.find((f) => f.id === place.folderId) : undefined);

/** Places in a folder; folderId '' means "not in any folder" (including places whose folder is gone). */
export function placesInFolder(places, folders, folderId) {
  if (folderId) return places.filter((p) => p.folderId === folderId);
  return places.filter((p) => !folderOf(p, folders));
}
