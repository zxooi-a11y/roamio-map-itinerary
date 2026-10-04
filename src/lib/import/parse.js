import { CATEGORIES } from '../categories.js';
import { ymd } from '../dates.js';

/*
 * Turn the text of an imported file (CSV, Markdown) or the cells of a spreadsheet into a
 * list of places:  { name, addr, lat, lng, day, time, cat, note }
 * `day` is { n: 1-based day number } | { date: "YYYY-MM-DD" } | null.
 * `lat` / `lng` are numbers when the file gave coordinates, otherwise null.
 */

/* ---------- Cell value cleaners ---------- */

const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

/** Number, "Day 3", "3" -> {n:3}; "2026-07-02", "2 Jul 2026" -> {date}. Otherwise null. */
export function parseDay(value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(?:day\s*)?#?(\d{1,3})$/i);
  if (m) return +m[1] >= 1 ? { n: +m[1] } : null;
  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  if (MONTHS.test(s) && /\d/.test(s)) {
    const t = Date.parse(s + (/\d{4}/.test(s) ? '' : ' ' + new Date().getFullYear()));
    if (!isNaN(t)) return { date: ymd(new Date(t)) };
  }
  return null;
}

function validDate(y, mo, d) {
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? { date: ymd(dt) } : null;
}

/** "9:00", "09:00", "9am", "9:30 PM", or a spreadsheet day-fraction (0.5 = noon) -> "HH:MM". Otherwise "". */
export function parseTime(value) {
  if (typeof value === 'number' && value > 0 && value < 1) {
    const mins = Math.round(value * 1440) % 1440;
    return pad(Math.floor(mins / 60)) + ':' + pad(mins % 60);
  }
  const s = String(value ?? '').trim().toLowerCase().replace(/^\d{4}-\d{2}-\d{2}[t\s]+/, ''); // a full date-time keeps its time
  const m = s.match(/^(\d{1,2})(?:[:.h](\d{2}))?(?::\d{2})?\s*(am|pm)?$/);
  if (!m) return '';
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (m[3]) { if (h < 1 || h > 12) return ''; h = (h % 12) + (m[3] === 'pm' ? 12 : 0); }
  return h > 23 || min > 59 ? '' : pad(h) + ':' + pad(min);
}
const pad = (n) => String(n).padStart(2, '0');

const CATEGORY_ALIASES = {
  cafe: 'Café', coffee: 'Café', restaurants: 'Restaurant', food: 'Restaurant', dining: 'Restaurant', eat: 'Restaurant',
  museums: 'Museum', gallery: 'Museum', parks: 'Park', nature: 'Park', beach: 'Park', shop: 'Shopping', shops: 'Shopping', store: 'Shopping',
  accommodation: 'Hotel', lodging: 'Hotel', stay: 'Hotel', bar: 'Nightlife', bars: 'Nightlife', club: 'Nightlife', sight: 'Landmark',
  sights: 'Landmark', attraction: 'Landmark', monument: 'Landmark', train: 'Transport', station: 'Transport', airport: 'Transport', flight: 'Transport',
};

/** "restaurant", "Cafe" -> a known category, or "" when we don't recognise it. */
export function parseCategory(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return '';
  return CATEGORIES.find((c) => c.toLowerCase() === s) || CATEGORY_ALIASES[s] || '';
}

function parseCoord(value, limit) {
  if (value === '' || value == null) return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return isFinite(n) && Math.abs(n) <= limit ? n : null;
}

const clean = (v) => (v instanceof Date ? '' : String(v ?? '').replace(/\s+/g, ' ').trim());

/* ---------- Rows (CSV / spreadsheet) -> places ---------- */

const HEADERS = {
  name: ['name', 'place', 'location', 'stop', 'title', 'destination', 'poi', 'place name', 'attraction', 'venue', 'activity', 'what'],
  addr: ['address', 'addr', 'street', 'full address'],
  lat: ['lat', 'latitude'],
  lng: ['lng', 'lon', 'long', 'longitude'],
  day: ['day', 'day #', 'day number', 'day no', 'date', 'day/date'],
  time: ['time', 'start', 'start time', 'when', 'at'],
  cat: ['category', 'type', 'kind'],
  note: ['note', 'notes', 'description', 'comment', 'comments', 'details', 'remarks'],
};

/** Map each field to a column index, using the first row as headers. Returns null if it doesn't look like a header row. */
export function detectColumns(headerRow) {
  const cols = {};
  headerRow.forEach((h, i) => {
    const key = clean(h).toLowerCase().replace(/[_*]/g, ' ').trim();
    for (const [field, names] of Object.entries(HEADERS)) {
      if (cols[field] === undefined && names.includes(key)) cols[field] = i;
    }
  });
  // A header row must say where the places are: a name, an address or coordinates
  return cols.name !== undefined || cols.addr !== undefined || (cols.lat !== undefined && cols.lng !== undefined) ? cols : null;
}

/**
 * rows: array of arrays of cells. The first non-empty row is read as headers when it has a recognisable
 * name / address / coordinate column; otherwise every row is data and the first column is the place name.
 */
export function rowsToPlaces(rows) {
  const data = rows.filter((r) => r.some((c) => clean(c)));
  if (!data.length) return [];
  const cols = detectColumns(data[0]);
  const body = cols ? data.slice(1) : data;
  const col = cols || { name: 0 };
  const cell = (r, f) => (col[f] === undefined ? '' : r[col[f]] ?? '');

  return body
    .map((r) => {
      const lat = parseCoord(cell(r, 'lat'), 90), lng = parseCoord(cell(r, 'lng'), 180);
      const hasCoords = lat !== null && lng !== null;
      return {
        name: clean(cell(r, 'name')),
        addr: clean(cell(r, 'addr')),
        lat: hasCoords ? lat : null,
        lng: hasCoords ? lng : null,
        day: parseDay(cell(r, 'day')),
        time: parseTime(cell(r, 'time')),
        cat: parseCategory(cell(r, 'cat')),
        note: clean(cell(r, 'note')),
      };
    })
    .filter((p) => p.name || p.addr || p.lat !== null)
    // a row with no name is named after its address, or (for coordinates only) the coordinates
    .map((p) => (p.name ? p : { ...p, name: p.addr || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` }));
}

/* ---------- CSV ---------- */

/** RFC-4180 style CSV -> array of arrays. The delimiter (, ; or tab) is detected from the first line. */
export function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const ch of first) { if (ch === '"') quoted = !quoted; else if (!quoted && ch in counts) counts[ch]++; }
  const delim = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];

  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else if (ch === '"' && field === '') inQuotes = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export const parseCsvPlaces = (text) => rowsToPlaces(parseCsv(text));

/* ---------- Markdown ---------- */

const SEPARATOR_ROW = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/;
const LEADING_TIME = /^(\d{1,2}(?:[:.h]\d{2})?\s*(?:am|pm)|\d{1,2}[:.h]\d{2})\s*[-–—:]?\s+/i;

const stripMarkdown = (s) => s
  .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) -> text
  .replace(/(\*\*|__|\*|_|`)/g, '')
  .replace(/\s+/g, ' ')
  .trim();

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => stripMarkdown(c.replace(/\\\|/g, '|')));
}

/** A heading like "Day 2 – Alfama", "Day 2" or "2026-07-02" starts a new day. */
function headingDay(text) {
  const m = text.match(/\bday\s*#?(\d{1,3})\b/i);
  if (m && +m[1] >= 1) return { n: +m[1] };
  const iso = text.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/);
  return (iso && parseDay(iso[0])) || parseDay(text);
}

/**
 * Markdown -> places. Understands:
 *   - bullet / numbered lists:  "- 09:00 Belém Tower – book ahead"  (name and note split on " – ", " — " or " - ")
 *   - pipe tables with a header row (same column names as CSV)
 *   - headings such as "## Day 2" or "## 2026-07-02" that set the day for what follows
 * Anything else (paragraphs, etc.) is ignored.
 */
export function parseMarkdownPlaces(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const places = [];
  let day = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/);
    if (heading) {
      const d = headingDay(stripMarkdown(heading[1]));
      if (d) day = d;
      continue;
    }

    if (/^\s*\|/.test(line) && i + 1 < lines.length && SEPARATOR_ROW.test(lines[i + 1].trim())) {
      const rows = [splitRow(line)];
      i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
      i--;
      rowsToPlaces(rows).forEach((p) => places.push({ ...p, day: p.day || day }));
      continue;
    }

    const item = line.match(LIST_ITEM);
    if (item) {
      let body = stripMarkdown(item[1]);
      const t = body.match(LEADING_TIME);
      const time = t ? parseTime(t[1]) : '';
      if (t) body = body.slice(t[0].length);
      const [name, ...rest] = body.split(/\s+[-–—]\s+/);
      if (name.trim()) places.push({ name: name.trim(), addr: '', lat: null, lng: null, day, time, cat: '', note: rest.join(' – ').trim() });
    }
  }
  return places;
}
