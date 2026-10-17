import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../../components/Sheet.jsx';
import { useToast } from '../../components/Toast.jsx';
import { ImportSection } from '../home/ImportSection.jsx';
import { useImportedFile } from '../home/useImportedFile.js';
import { plural } from '../../lib/dates.js';
import { buildStops, rangeSpan } from '../../lib/import/addToTrip.js';
import { resolvePlaces } from '../../lib/import/resolve.js';
import { dateRange } from '../../lib/tripDates.js';

/**
 * "Import places" for a trip that already exists: pick a CSV / XLSX / Markdown file and a start and end date; the
 * places are added to the days of that range (a place with a date or day number in the file goes on that day, the rest
 * are spread evenly in file order). Days the range needs are added to the trip. onImport({ start, end, items }) gets the stops.
 */
export function ImportPlacesDialog({ trip, onClose, onImport }) {
  const toast = useToast();
  const range = dateRange(trip);
  const [start, setStart] = useState(range?.start || '');
  const [end, setEnd] = useState(range?.end || '');
  const [progress, setProgress] = useState(null);
  const file = useImportedFile();
  const abortRef = useRef(null);
  const busy = progress !== null;
  useEffect(() => () => abortRef.current?.abort(), []);

  const changeStart = (v) => { setStart(v); if (v && (!end || end < v)) setEnd(v); };
  const changeEnd = (v) => { setEnd(v); if (v && (!start || v < start)) setStart(v); };

  const dated = Boolean(start && end);
  const span = dated ? rangeSpan(start, end) : trip.days.length;
  const canImport = Boolean(file.imported) && !busy && !file.reading && (dated || (!start && !end));

  const run = async () => {
    if (!canImport) return;
    const ctl = new AbortController();
    abortRef.current = ctl;
    const lookups = file.imported.places.filter((p) => p.lat === null).length;
    setProgress({ done: 0, total: lookups });
    const places = await resolvePlaces(file.imported.places, {
      context: trip.place, signal: ctl.signal, onProgress: (done, total) => setProgress({ done, total }),
    });
    if (ctl.signal.aborted) return;
    const { items, placed, unplaced, skipped } = buildStops(places, { start: dated ? start : '', span, fallback: trip.center });
    onImport({ start: dated ? start : '', end: dated ? end : '', items });
    const n = placed + unplaced;
    toast(!n ? 'No places were added.'
      : `Added ${plural(n, 'place')}` + (dated ? ` across ${plural(span, 'day')}` : '') + '.'
        + (unplaced ? ` ${unplaced} couldn't be found and ${unplaced === 1 ? 'was' : 'were'} put at the destination: drag the pins to fix them.` : '')
        + (skipped ? ` ${plural(skipped, 'place')} couldn't be found and ${skipped === 1 ? 'was' : 'were'} skipped.` : ''));
  };

  return (
    <Sheet onClose={onClose} titleId="ip-title" title="Import places" subtitle="Add a file of places to this trip."
      footer={<>
        <button className="btn-plain" type="button" onClick={onClose}>Cancel</button>
        <button className="btn" type="button" disabled={!canImport} onClick={run}>{busy ? 'Importing…' : 'Import'}</button>
      </>}>
      <div className="ad-fields ad-fields-flush">
        <div>
          <label className="ad-lbl" htmlFor="ip-start">From</label>
          <input className="ad-in" id="ip-start" type="date" value={start} disabled={busy} onChange={(e) => changeStart(e.target.value)} />
        </div>
        <div>
          <label className="ad-lbl" htmlFor="ip-end">To</label>
          <input className="ad-in" id="ip-end" type="date" min={start || undefined} value={end} disabled={busy} onChange={(e) => changeEnd(e.target.value)} />
        </div>
        <div className="wide ct-note">
          {dated
            ? `Places are spread over ${plural(span, 'day')} in the order of the file. A place with a date or day number in the file goes on that day. Days outside the trip's dates are added.`
            : 'Pick the dates to add the places on, or leave both empty to spread them over the days the trip already has.'}
        </div>
        <ImportSection file={file} progress={progress} disabled={busy} />
      </div>
    </Sheet>
  );
}
