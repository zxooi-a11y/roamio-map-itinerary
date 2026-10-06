import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PlaceSearch } from '../../components/PlaceSearch.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { usePlaceSearch } from '../../hooks/usePlaceSearch.js';
import { guessCategory } from '../../lib/categories.js';
import { parseGoogleMapsUrl } from '../../lib/geocode.js';
import { countryName, flagEmoji, FOLDER_NAME_MAX, makeFolder, parseLink } from '../../lib/inspiration.js';

const NEW = '__new__';
const EMPTY = { link: '', spot: null, country: '', countryCode: '', note: '', folderId: '', newFolder: '' };

function fromPlace(p) {
  return {
    link: p.link, note: p.note, folderId: p.folderId, newFolder: '', country: p.countryCode ? countryName(p) : p.country, countryCode: p.countryCode,
    // a link saved without a place starts with no place picked, ready to search for it
    spot: p.needsPlace ? null : { name: p.name, address: p.address, city: p.city, lat: p.lat, lng: p.lng, cat: p.cat },
  };
}

/**
 * Add or edit a saved place: paste the Instagram link, find the place (which fills in the country), add a note.
 * The link alone is enough to save: the place can be added later (it's kept as "needs a place").
 *   place          the place being edited, or null to add a new one
 *   initialLink    a link to start with (arrived from Instagram's share menu)
 *   countryHint    { key, name, code } of the country page this was opened from (pre-fills, and limits the search)
 *   folders        the folders to choose from; "New folder…" in the picker makes one on save
 *   defaultFolderId  the folder a new place starts in (the folder page it was opened from)
 *   onSave(fields, { another, newFolder })  newFolder = a folder to create along with the place; another = keep the dialog open for the next place
 */
export function PlaceDialog({ place, initialLink = '', countryHint, folders = [], defaultFolderId = '', onSave, onClose }) {
  const editing = Boolean(place);
  const initial = editing ? fromPlace(place)
    : { ...EMPTY, link: initialLink, folderId: defaultFolderId, country: countryHint?.name || '', countryCode: countryHint?.code || '' };
  const [form, setForm] = useState(initial);
  const [onlyHere, setOnlyHere] = useState(Boolean(countryHint?.code) && !editing);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const search = usePlaceSearch({ limit: 6, countryCodes: onlyHere ? countryHint?.code : undefined });
  // Switching to "search everywhere" re-runs the current search without the country limit
  useEffect(() => {
    if (search.query.trim().length >= 2) search.searchNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyHere]);

  const link = parseLink(form.link);
  const shortMapsLink = Boolean(parseGoogleMapsUrl(search.q)?.short);
  const linkBad = form.link.trim() !== '' && !link;

  const pick = (r) => {
    set({
      spot: { name: r.name, address: r.addr, city: r.city, lat: r.lat, lng: r.lng, cat: r.cat },
      // the place's own country wins, unless it has none
      ...(r.country || r.countryCode ? { country: r.countryCode ? countryName(r) : r.country, countryCode: r.countryCode } : {}),
    });
  };
  const useTyped = () => {
    const name = search.q.trim();
    set({ spot: { name, address: '', city: '', lat: null, lng: null, cat: guessCategory(name) } });
  };

  // A place, or just a valid link (saved now, place added later)
  const linkOnly = !form.spot && Boolean(link);
  const creating = form.folderId === NEW;
  const newName = form.newFolder.replace(/\s+/g, ' ').trim();
  const existing = creating && folders.find((f) => f.name.toLowerCase() === newName.toLowerCase());
  const canSave = (Boolean(form.spot?.name) || linkOnly) && !linkBad && (!creating || Boolean(newName));
  const save = (another) => {
    if (!canSave) return;
    const newFolder = creating && !existing ? makeFolder(newName) : null;
    const folderId = newFolder ? newFolder.id : existing ? existing.id : folders.some((f) => f.id === form.folderId) ? form.folderId : '';
    const spot = form.spot || { name: link.label, address: '', city: '', lat: null, lng: null, cat: 'Other' };
    onSave({
      ...spot,
      country: form.country.trim(),
      countryCode: form.countryCode,
      link: link?.url || '',
      note: form.note.trim(),
      needsPlace: linkOnly,
      folderId,
    }, { another, newFolder });
    if (another) {
      // keep the country and folder for the next one; clear the rest
      setForm({ ...EMPTY, country: form.country, countryCode: form.countryCode, folderId });
      search.reset();
    }
  };

  return (
    <Sheet onClose={onClose} titleId="pl-title" title={editing ? 'Edit place' : 'Save a place'}
      subtitle={editing ? '' : 'Keep a place from Instagram for a future trip.'}
      footer={<>
        <button className="btn-plain" type="button" onClick={onClose}>Cancel</button>
        {!editing && <button className="btn-plain" type="button" disabled={!canSave} title="Save, then add another place" onClick={() => save(true)}>Save &amp; next</button>}
        <button className="btn" type="button" disabled={!canSave} onClick={() => save(false)}>{linkOnly ? 'Save link' : 'Save'}</button>
      </>}>
      <div className="ad-fields ad-fields-flush">
        <div className="wide">
          <label className="ad-lbl" htmlFor="pl-link">Instagram link</label>
          <div className="pl-link-row">
            <input className="ad-in" id="pl-link" type="url" inputMode="url" autoComplete="off" autoFocus={!editing && !initialLink}
              placeholder="Paste the post or reel link" value={form.link} onChange={(e) => set({ link: e.target.value })} />
          </div>
          <div className={'pl-link-status' + (linkBad ? ' is-bad' : '')} role="status">
            {linkBad ? "That doesn't look like a link." : link ? <><Icon name={link.kind === 'instagram' ? 'instagram' : 'link'} />{link.label}</> : ''}
          </div>
        </div>

        <div className="wide">
          <span className="ad-lbl">Place</span>
          {form.spot ? (
            <div className="ad-picked pl-picked">
              <span className="ad-ico"><Icon name={form.spot.cat} /></span>
              <span>
                <span className="ad-name">{form.spot.name}</span>
                <span className="ad-addr">{form.spot.address || (form.spot.lat === null ? 'No map location' : '')}</span>
              </span>
              <button className="ad-link" type="button" onClick={() => set({ spot: null })}>Change</button>
            </div>
          ) : (
            <>
              <PlaceSearch id="pl-q" placeholder="Search the place, e.g. the café or viewpoint" search={search}
                hint={onlyHere ? `Searching in ${flagEmoji(countryHint.code)} ${countryHint.name}.` : 'Type the place\'s name, or paste its Google Maps link.'}
                iconFor={(r) => r.cat} onPick={pick} />
              {onlyHere && (
                <button className="ad-link pl-everywhere" type="button" onClick={() => setOnlyHere(false)}>
                  Search everywhere instead
                </button>
              )}
              {shortMapsLink && <p className="pl-later">That's a short Google Maps link, which can't be read here. Open it, then copy the full address from the browser's address bar.</p>}
              {search.q && !shortMapsLink && ['done', 'error'].includes(search.status) && (
                <button className="ad-fallback" type="button" onClick={useTyped}>
                  Save “{search.q}” without a map location
                </button>
              )}
              {linkOnly && <p className="pl-later">No place yet? You can save just the link now and add the place later.</p>}
            </>
          )}
        </div>

        <div className="wide">
          <label className="ad-lbl" htmlFor="pl-folder">Folder (optional)</label>
          <select className="ad-in" id="pl-folder" value={creating || folders.some((f) => f.id === form.folderId) ? form.folderId : ''}
            onChange={(e) => set({ folderId: e.target.value, newFolder: e.target.value === NEW && !form.newFolder ? form.country : form.newFolder })}>
            <option value="">No folder</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            <option value={NEW}>+ New folder…</option>
          </select>
          {creating && (
            <>
              <input className="ad-in pl-newfolder" aria-label="New folder name" autoFocus maxLength={FOLDER_NAME_MAX} placeholder="Folder name, e.g. Malaysia"
                value={form.newFolder} onChange={(e) => set({ newFolder: e.target.value })} />
              {existing && <p className="pl-later">You already have “{existing.name}”. The place will go in that folder.</p>}
            </>
          )}
        </div>

        <div className="wide">
          <label className="ad-lbl" htmlFor="pl-note">Note (optional)</label>
          <textarea className="ad-in pl-note" id="pl-note" rows={2} placeholder="What to order, best time to go…"
            value={form.note} onChange={(e) => set({ note: e.target.value })} />
        </div>
      </div>
    </Sheet>
  );
}
