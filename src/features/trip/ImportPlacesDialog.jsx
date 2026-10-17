import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../../components/Sheet.jsx';
import { useToast } from '../../components/Toast.jsx';
import { ImportSection } from '../home/ImportSection.jsx';
import { useImportedFile } from '../home/useImportedFile.js';
import { plural } from '../../lib/dates.js';
import { buildStops, rangeSpan } from '../../lib/import/addToTrip.js';
import { UNPLACED_NOTE } from '../../lib/import/buildTrip.js';
import { resolvePlaces } from '../../lib/import/resolve.js';
import { dateRange } from '../../lib/tripDates.js';
import { ImportPlanner } from './ImportPlanner.jsx';

/**
 * "Import places" for a trip that already exists: pick a CSV / XLSX / Markdown file and a start and end date. Then either
 *  - Spread over the days: a place with a date or day number in the file goes on that day, the rest are spread evenly
 *    in file order; or
 *  - Group on the map: see every place on a map and lasso them into days (ImportPlanner); nothing is added until Submit.
 * Days the range needs are added to the trip. onImport({ start, end, items, titles }) gets the stops.
 */
export function ImportPlacesDialog({ trip, onClose, onImport }) {
  const toast = useToast();
  const range = dateRange(trip);
  const [start, setStart] = useState(range?.start || '');
  const [end, setEnd] = useState(range?.end || '');
  const [progress, setProgress] = useState(null);
  const [planning, setPlanning] = useState(null); // { stops, unplaced, skipped } while grouping the places on the map
  const file = useImportedFile();
  const abortRef = useRef(null);
  const busy = progress !== null;
  useEffect(() => () => abortRef.current?.abort(), []);

  const changeStart = (v) => { setStart(v); if (v && (!end || end < v)) setEnd(v); };
  const changeEnd = (v) => { setEnd(v); if (v && (!start || v < start)) setStart(v); };

  const dated = Boolean(start && end);
  const span = dated ? rangeSpan(start, end) : trip.days.length;
  const canImport = Boolean(file.imported) && !busy && !file.reading && (dated || (!start && !end));

  // Look up the places, then either spread them over the days, or open the map to group them into days by hand.
  const run = async (mode) => {
    if (!canImport) return;
    const ctl = new AbortController();
    abortRef.current = ctl;
    const lookups = file.imported.places.filter((p) => p.lat === null).length;
    setProgress({ done: 0, total: lookups });
    const places = await resolvePlaces(file.imported.places, {
      context: trip.place, signal: ctl.signal, onProgress: (done, total) => setProgress({ done, total }),
    });
    if (ctl.signal.aborted) return;
    setProgress(null);
    const built = buildStops(places, { start: dated ? start : '', span, fallback: trip.center });
    if (mode === 'map') { setPlanning(built); return; }
    finish(built.items, {}, built);
  };

  const finish = (items, titles, { unplaced, skipped }) => {
    onImport({ start: dated ? start : '', end: dated ? end : '', items, titles });
    const n = items.length;
    const days = new Set(items.map((x) => x.offset)).size;
    toast(!n ? 'No places were added.'
      : `Added ${plural(n, 'place')} across ${plural(days, 'day')}.`
        + (unplaced ? ` ${unplaced} couldn't be found and ${unplaced === 1 ? 'was' : 'were'} put at the destination: drag the pins to fix them.` : '')
        + (skipped ? ` ${plural(skipped, 'place')} couldn't be found and ${skipped === 1 ? 'was' : 'were'} skipped.` : ''));
  };

  if (planning) {
    return (
      <ImportPlanner trip={trip} stops={planning.items.map((x) => x.stop)} start={dated ? start : ''} span={span}
        onBack={() => setPlanning(null)} onCancel={onClose}
        onSubmit={({ items, titles }) => finish(items, titles, { unplaced: items.filter((x) => x.stop.note === UNPLACED_NOTE).length, skipped: planning.skipped })} />
    );
  }

  return (
    <Sheet onClose={onClose} titleId="ip-title" title="Import places" subtitle="Add a file of places to this trip."
      footer={<>
        <button className="btn-plain" type="button" onClick={onClose}>Cancel</button>
        <button className="btn-plain" type="button" disabled={!canImport} onClick={() => run('spread')}>Spread over the days</button>
        <button className="btn" type="button" disabled={!canImport} onClick={() => run('map')}>{busy ? 'Finding places…' : 'Group on the map'}</button>
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
            ? `${plural(span, 'day')}. Group on the map to draw around the places for each day, or spread them over the days in the order of the file. Days outside the trip's dates are added.`
            : 'Pick the dates to add the places on, or leave both empty to spread them over the days the trip already has.'}
        </div>
        <ImportSection file={file} progress={progress} disabled={busy} />
      </div>
    </Sheet>
  );
}
