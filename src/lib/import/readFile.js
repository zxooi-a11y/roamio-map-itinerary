import { parseCsvPlaces, parseMarkdownPlaces, rowsToPlaces } from './parse.js';

export const ACCEPTED_EXTENSIONS = ['csv', 'xlsx', 'md', 'markdown'];
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map((e) => '.' + e).join(',');
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_PLACES = 200;

const extensionOf = (name) => (name.split('.').pop() || '').toLowerCase();

/**
 * Read an uploaded file into a list of places (see parse.js for the shape).
 * Throws an Error with a user-friendly message when the file can't be used.
 */
export async function readPlacesFromFile(file) {
  const ext = extensionOf(file.name);
  if (ext === 'xls') {
    throw new Error('Old .xls files aren\'t supported yet. Please save it as .xlsx or .csv and try again.');
  }
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    throw new Error('Please choose a .csv, .xlsx or .md file.');
  }
  if (file.size > MAX_FILE_BYTES) throw new Error('That file is too large (limit 5 MB).');

  let places;
  try {
    if (ext === 'csv') places = parseCsvPlaces(await file.text());
    else if (ext === 'xlsx') places = rowsToPlaces(await readXlsxRows(file));
    else places = parseMarkdownPlaces(await file.text());
  } catch (err) {
    throw new Error('Could not read that file. Is it a valid .' + ext + ' file?', { cause: err });
  }

  if (!places.length) throw new Error('No locations found in that file.');
  if (places.length > MAX_PLACES) throw new Error(`That file has ${places.length} locations. The limit is ${MAX_PLACES}.`);
  return places;
}

/** First sheet of an .xlsx as rows of cells. Loaded on demand so it doesn't weigh down the main bundle. */
async function readXlsxRows(file) {
  const { readSheet } = await import('read-excel-file/browser');
  return (await readSheet(file)).map((row) => row.map(cellToValue));
}

const MINUTE = 60000, DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');

/**
 * The spreadsheet reader returns date and time cells as Dates whose UTC fields hold the cell's
 * wall-clock value (Excel stores times as fractions of a day, so they carry tiny rounding errors).
 * Turn them into plain text so the user's time zone can never shift them:
 *   a time-only cell -> "HH:MM"     a date cell -> "YYYY-MM-DD"     both -> "YYYY-MM-DD HH:MM"
 * (the parsers read whichever part they need from each).
 */
export function cellToValue(cell) {
  if (!(cell instanceof Date) || isNaN(cell)) return cell;
  const t = Math.round(cell.getTime() / MINUTE) * MINUTE; // nearest minute
  const d = new Date(t);
  if (d.getUTCFullYear() <= 1900) { // Excel's "day zero": a time with no date
    const mins = Math.round((((t % DAY) + DAY) % DAY) / MINUTE);
    return pad(Math.floor(mins / 60) % 24) + ':' + pad(mins % 60);
  }
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return mins ? `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : date;
}
