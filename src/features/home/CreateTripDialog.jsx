import { useEffect, useRef, useState } from 'react';
import { PlaceSearch } from '../../components/PlaceSearch.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { useToast } from '../../components/Toast.jsx';
import { usePlaceSearch } from '../../hooks/usePlaceSearch.js';
import { daysBetween, fmtShort, plural } from '../../lib/dates.js';
import { buildImportedTrip } from '../../lib/import/buildTrip.js';
import { resolvePlaces } from '../../lib/import/resolve.js';
import { MAX_TRIP_DAYS, makeTrip } from '../../lib/trips.js';
import { ImportSection } from './ImportSection.jsx';
import { useImportedFile } from './useImportedFile.js';

const fileLabel = (filename) => filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

/** "Create a trip" pop-up, optionally filled from an imported file of locations. Calls onCreate(trip). */
export function CreateTripDialog({ onClose, onCreate }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [dest, setDest] = useState(null); // { name, lat, lng } once a search result is picked
  const [progress, setProgress] = useState(null); // { done, total } while import lookups run
  const search = usePlaceSearch({ limit: 5 });
  const file = useImportedFile();
  const abortRef = useRef(null);
  const busy = progress !== null;

  // Closing the dialog cancels any lookups still running.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the two dates consistent: the end can never be before the start.
  const changeStart = (v) => { setStart(v); if (v && (!end || end < v)) setEnd(v); };
  const changeEnd = (v) => { setEnd(v); if (v && (!start || v < start)) setStart(v); };

  const pickDestination = (r) => {
    const label = r.country && r.country !== r.name ? r.name + ', ' + r.country : r.name;
    setDest({ name: label, lat: r.lat, lng: r.lng });
    search.reset(r.name);
    if (!name.trim()) setName('Trip to ' + r.name);
  };

  const chooseFile = async (f) => {
    const ok = await file.choose(f);
    if (ok) setName((current) => current.trim() ? current : fileLabel(f.name));
  };

  const canCreate = name.trim().length > 0 && !busy && !file.reading;

  const create = async () => {
    if (!canCreate) return;
    const base = {
      title: name.trim(),
      place: dest ? dest.name : search.query.trim(),
      center: dest ? { lat: dest.lat, lng: dest.lng } : null,
      start, end,
    };
    if (!file.imported) { onCreate(makeTrip(base)); return; }

    const ctl = new AbortController();
    abortRef.current = ctl;
    const lookups = file.imported.places.filter((p) => p.lat === null).length;
    setProgress({ done: 0, total: lookups });
    const places = await resolvePlaces(file.imported.places, {
      context: base.place, signal: ctl.signal,
      onProgress: (done, total) => setProgress({ done, total }),
    });
    if (ctl.signal.aborted) return;

    const { trip, placed, unplaced, skipped } = buildImportedTrip({ ...base, places });
    toast(importSummary(placed, unplaced, skipped));
    onCreate(trip);
  };

  let dateNote = 'No dates? No problem. The trip will be tagged “Just planning”.';
  if (start && end) {
    const n = daysBetween(start, end) + 1;
    dateNote = `${fmtShort(start, true)} to ${fmtShort(end, true)} · ${plural(n, 'day')}` +
      (n > MAX_TRIP_DAYS ? ` (trips are limited to ${MAX_TRIP_DAYS} days, so the end will be trimmed)` : '');
  } else if (file.imported?.places.some((p) => p.day?.date)) {
    dateNote = 'No dates entered, so the dates in your file will be used.';
  }

  return (
    <Sheet onClose={onClose} titleId="ct-title" title="Create a trip"
      subtitle="Name it, pick a destination and choose your dates, or leave the dates empty if you are just planning."
      footer={<>
        <button className="btn-plain" type="button" onClick={onClose}>Cancel</button>
        <button className="btn" type="button" disabled={!canCreate} onClick={create}>
          {busy ? 'Creating…' : 'Create trip'}
        </button>
      </>}>
      <div className="ad-fields ad-fields-flush">
        <div className="wide">
          <label className="ad-lbl" htmlFor="ct-name">Trip name</label>
          <input className="ad-in" id="ct-name" type="text" placeholder="Name your trip" autoComplete="off" autoFocus
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }} />
        </div>
        <div className="wide">
          <label className="ad-lbl" htmlFor="ct-q">Destination (optional)</label>
          <PlaceSearch id="ct-q" placeholder="Search for a city or country"
            search={{ ...search, onQueryChange: (v) => { setDest(null); search.onQueryChange(v); } }}
            hint={dest ? 'Destination set: ' + dest.name : ''}
            errorText="Couldn't reach the search service. You can still create the trip."
            onPick={pickDestination} />
        </div>
        <div>
          <label className="ad-lbl" htmlFor="ct-start">Start date</label>
          <input className="ad-in" id="ct-start" type="date" value={start} onChange={(e) => changeStart(e.target.value)} />
        </div>
        <div>
          <label className="ad-lbl" htmlFor="ct-finish">End date</label>
          <input className="ad-in" id="ct-finish" type="date" min={start || undefined} value={end} onChange={(e) => changeEnd(e.target.value)} />
        </div>
        <div className="wide ct-note">{dateNote}</div>
        <ImportSection file={{ ...file, choose: chooseFile }} progress={progress} disabled={busy} />
      </div>
    </Sheet>
  );
}

function importSummary(placed, unplaced, skipped) {
  const found = placed + unplaced === 0 ? 'No locations imported.' : `Imported ${plural(placed + unplaced, 'location')}.`;
  const verb = (n) => (n === 1 ? 'was' : 'were');
  if (unplaced) return `${found} ${unplaced} couldn't be found and ${verb(unplaced)} placed at the destination. Drag the pins to fix them.`;
  if (skipped) return `${found} ${plural(skipped, 'location')} couldn't be found and ${verb(skipped)} skipped. Choose a destination next time so unfound places can still be added.`;
  return found;
}
