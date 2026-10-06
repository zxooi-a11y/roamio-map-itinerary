import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { PlaceSearch } from '../../components/PlaceSearch.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { useToast } from '../../components/Toast.jsx';
import { usePlaceSearch } from '../../hooks/usePlaceSearch.js';
import { guessCategory } from '../../lib/categories.js';
import { countryName, flagEmoji, parseLink } from '../../lib/inspiration.js';
import { extractUrl } from '../../lib/shareIntake.js';

const EMPTY = { link: '', spot: null, country: '', countryCode: '', note: '' };

function fromPlace(p) {
  return {
    link: p.link, note: p.note, country: p.countryCode ? countryName(p) : p.country, countryCode: p.countryCode,
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
 *   countries      [{ name, code }] already used, offered as suggestions when typing a country
 *   onSave(fields, { another })  another = keep the dialog open for the next place
 */
export function PlaceDialog({ place, initialLink = '', countryHint, countries, onSave, onClose }) {
  const editing = Boolean(place);
  const toast = useToast();
  const initial = editing ? fromPlace(place)
    : { ...EMPTY, link: initialLink, country: countryHint?.name || '', countryCode: countryHint?.code || '' };
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
  const linkBad = form.link.trim() !== '' && !link;
  const canPaste = Boolean(navigator.clipboard?.readText);

  const paste = async () => {
    try {
      const found = parseLink(extractUrl(await navigator.clipboard.readText()));
      if (found) set({ link: found.url });
      else toast('No link found on the clipboard. Copy the post link in Instagram first.');
    } catch {
      toast("Couldn't read the clipboard. Paste into the box instead.");
    }
  };

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
  const changeCountry = (value) => {
    // Typing a country we already use links it to the same group (and flag)
    const known = countries.find((c) => c.name.toLowerCase() === value.trim().toLowerCase());
    set({ country: value, countryCode: known?.code || '' });
  };

  // A place, or just a valid link (saved now, place added later)
  const linkOnly = !form.spot && Boolean(link);
  const canSave = (Boolean(form.spot?.name) || linkOnly) && !linkBad;
  const save = (another) => {
    if (!canSave) return;
    const spot = form.spot || { name: link.label, address: '', city: '', lat: null, lng: null, cat: 'Other' };
    onSave({
      ...spot,
      country: form.country.trim(),
      countryCode: form.countryCode,
      link: link?.url || '',
      note: form.note.trim(),
      needsPlace: linkOnly,
    }, { another });
    if (another) {
      // keep the country for the next one; clear the rest
      setForm({ ...EMPTY, country: form.country, countryCode: form.countryCode });
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
            {canPaste && <button className="btn-plain pl-paste" type="button" onClick={paste}>Paste</button>}
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
                hint={onlyHere ? `Searching in ${flagEmoji(countryHint.code)} ${countryHint.name}.` : 'Type the name of the place from the post.'}
                iconFor={(r) => r.cat} onPick={pick} />
              {onlyHere && (
                <button className="ad-link pl-everywhere" type="button" onClick={() => setOnlyHere(false)}>
                  Search everywhere instead
                </button>
              )}
              {search.q && ['done', 'error'].includes(search.status) && (
                <button className="ad-fallback" type="button" onClick={useTyped}>
                  Save “{search.q}” without a map location
                </button>
              )}
              {linkOnly && <p className="pl-later">No place yet? You can save just the link now and add the place later.</p>}
            </>
          )}
        </div>

        <div className="wide">
          <label className="ad-lbl" htmlFor="pl-country">Country</label>
          <input className="ad-in" id="pl-country" list="pl-countries" autoComplete="off" placeholder="Filled in when you pick a place"
            value={form.country} onChange={(e) => changeCountry(e.target.value)} />
          <datalist id="pl-countries">{countries.map((c) => <option key={c.code || c.name} value={c.name} />)}</datalist>
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
