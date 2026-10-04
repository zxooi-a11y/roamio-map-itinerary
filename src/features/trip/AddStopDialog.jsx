import { useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PlaceSearch } from '../../components/PlaceSearch.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { usePlaceSearch } from '../../hooks/usePlaceSearch.js';
import { CATEGORIES, guessCategory } from '../../lib/categories.js';
import { newId } from '../../lib/ids.js';
import { dayColor } from '../../lib/theme.js';

const APPROX_NOTE = 'Location approximate. Drag the pin to place it.';

/**
 * "Add a stop" pop-up, in two steps: search for a place, then set time / type / note.
 * `map` is the TripMap API (search is biased to the visible area; fallback pins go to its centre).
 */
export function AddStopDialog({ day, dayIndex, map, onClose, onAdd }) {
  const search = usePlaceSearch({ limit: 6, getViewbox: map?.getViewbox });
  const [picked, setPicked] = useState(null); // { name, addr, lat, lng, cat, approx? }
  const [time, setTime] = useState('');
  const [cat, setCat] = useState('Other');
  const [note, setNote] = useState('');

  const pick = (p) => { setPicked(p); setCat(p.cat); };

  const pickAnyway = () => {
    const q = search.query.trim();
    const c = map?.getCenter() || { lat: 0, lng: 0 };
    pick({ name: q, addr: 'Location not set. Drag its pin on the map to place it.', lat: c.lat, lng: c.lng, cat: guessCategory(q), approx: true });
  };

  const add = () => {
    if (!picked) return;
    onAdd({
      id: newId(), name: picked.name, time, cat,
      note: note.trim() || (picked.approx ? APPROX_NOTE : ''),
      lat: picked.lat, lng: picked.lng,
    });
  };

  const showFallback = search.status === 'error' || (search.status === 'done' && !search.results.length);

  return (
    <Sheet onClose={onClose} titleId="ad-title" title="Add a stop" style={{ '--c': dayColor(dayIndex) }}
      subtitle={'Day ' + (dayIndex + 1) + (day.title ? ' · ' + day.title : '')}
      footer={<>
        <button className="btn-plain" type="button" onClick={onClose}>Cancel</button>
        <button className="btn" type="button" disabled={!picked} onClick={add}>Add stop</button>
      </>}>
      {!picked ? (
        <div>
          <PlaceSearch id="ad-q" placeholder="Search for a place or address" autoFocus search={search}
            hint="Type a place name, landmark or address." iconFor={(r) => r.cat} onPick={pick} />
          {showFallback && (
            <button className="ad-fallback" type="button" onClick={pickAnyway}>
              Add “{search.q}” anyway at the current map centre
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="ad-picked">
            <span className="ad-ico"><Icon name={picked.cat} /></span>
            <span>
              <span className="ad-name">{picked.name}</span>
              <span className="ad-addr">{picked.addr}</span>
            </span>
            <button className="ad-link" type="button" onClick={() => setPicked(null)}>Change</button>
          </div>
          <div className="ad-fields">
            <div>
              <label className="ad-lbl" htmlFor="ad-time">Time</label>
              <input className="ad-in" id="ad-time" type="time" autoFocus value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <label className="ad-lbl" htmlFor="ad-cat">Type</label>
              <select className="ad-in" id="ad-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="wide">
              <label className="ad-lbl" htmlFor="ad-note">Note (optional)</label>
              <input className="ad-in" id="ad-note" type="text" placeholder="Booking number, tips, what to try…"
                value={note} onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
