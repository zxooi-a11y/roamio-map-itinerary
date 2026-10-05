import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { useToast } from '../../components/Toast.jsx';
import { inspirationHref } from '../../hooks/useHashRoute.js';
import { plural } from '../../lib/dates.js';
import { groupByCountry, makePlace, mapsUrl, parseLink, searchPlacesList } from '../../lib/inspiration.js';
import { useInspiration } from '../../store/InspirationProvider.jsx';
import { PlaceDialog } from './PlaceDialog.jsx';

/** The URL key of a country group; places with no country use "-". */
const routeKey = (g) => g.key || '-';
const countriesText = (n) => n + (n === 1 ? ' country' : ' countries');

/**
 * Places saved for future travels, grouped by country.
 *   "#/inspiration"        every country
 *   "#/inspiration/<key>"  one country (key from countryKey: "jp", or a typed country name)
 */
export function InspirationView({ country }) {
  const { places, dispatch, status, loadError, reload } = useInspiration();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(null); // null | { place: null } (new) | { place } (edit)

  const groups = useMemo(() => groupByCountry(places), [places]);
  const current = country ? groups.find((g) => routeKey(g) === country) : null;
  const countries = useMemo(() => groups.filter((g) => g.key).map((g) => ({ name: g.name, code: g.places[0].countryCode })), [groups]);

  useEffect(() => { document.title = (current ? current.name + ' · ' : '') + 'Inspiration · Trip planner'; }, [current]);
  useEffect(() => { window.scrollTo(0, 0); setQuery(''); }, [country]);

  const shown = (country ? groups.filter((g) => routeKey(g) === country) : groups)
    .map((g) => ({ ...g, places: searchPlacesList(g.places, query) }))
    .filter((g) => g.places.length);

  const save = (fields, { another }) => {
    if (dialog.place) {
      dispatch({ type: 'place/update', id: dialog.place.id, patch: fields });
      toast(`Saved changes to ${fields.name}.`);
    } else {
      dispatch({ type: 'place/add', place: makePlace(fields) });
      toast(`Saved ${fields.name}.`);
    }
    if (!another) setDialog(null);
  };
  const remove = (p) => {
    if (confirm(`Delete “${p.name}” from your saved places?`)) dispatch({ type: 'place/remove', id: p.id });
  };

  const title = current ? `${current.flag ? current.flag + ' ' : ''}${current.name}` : 'Inspiration';
  const countLine = current
    ? plural(current.places.length, 'saved place')
    : places.length ? `${plural(places.length, 'saved place')} · ${countriesText(groups.length)}` : 'Places you want to visit one day';

  return (
    <div className="insp-wrap">
      <header className="insp-head">
        <a className="back" href={current || country ? inspirationHref() : '#/'}>
          <Icon name="back" />{current || country ? 'All countries' : 'All trips'}
        </a>
        <h1 className="insp-title">{title}</h1>
        <p className="subtitle">{countLine}</p>
      </header>

      {status === 'loading' && <p className="insp-empty">Loading your saved places…</p>}
      {status === 'error' && <SetupOrError error={loadError} onRetry={reload} />}

      {status === 'ready' && (
        <>
          <div className="insp-toolbar">
            {places.length > 0 && (
              <label className="ad-search insp-search">
                <Icon name="search" />
                <input className="ad-in" type="search" placeholder={current ? `Search ${current.name}` : 'Search saved places'}
                  aria-label="Search saved places" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
            )}
            <button className="btn insp-add" type="button" onClick={() => setDialog({ place: null })}>
              <Icon name="plus" />Save a place
            </button>
          </div>

          {groups.length > 1 && (
            <nav className="insp-countries" aria-label="Countries">
              <a className="chip" href={inspirationHref()} aria-current={!country ? 'page' : undefined}>All · {places.length}</a>
              {groups.map((g) => (
                <a key={routeKey(g)} className="chip" href={inspirationHref(routeKey(g))} aria-current={country === routeKey(g) ? 'page' : undefined}>
                  {g.flag && <span aria-hidden="true">{g.flag}</span>}{g.name} · {g.places.length}
                </a>
              ))}
            </nav>
          )}

          {!places.length && (
            <div className="insp-empty-card">
              <Icon name="instagram" />
              <p><strong>Save places from Instagram for your future trips.</strong></p>
              <p>Copy a post or reel's link, tap <em>Save a place</em>, paste it and search the place's name. Places are grouped by country, so when you plan a trip everything you've saved for that country is in one spot.</p>
            </div>
          )}
          {places.length > 0 && !shown.length && (
            <p className="insp-empty">{query ? `Nothing matches “${query}”.` : 'No saved places here.'}</p>
          )}

          {shown.map((g) => (
            <section key={routeKey(g)} className="insp-group" aria-label={g.name}>
              {!country && (
                <h2 className="insp-group-title">
                  <a href={inspirationHref(routeKey(g))}>{g.flag && <span aria-hidden="true">{g.flag} </span>}{g.name}</a>
                  <span className="sec-count">{g.places.length}</span>
                </h2>
              )}
              <ul className="insp-grid">
                {g.places.map((p) => <PlaceCard key={p.id} place={p} onEdit={() => setDialog({ place: p })} onDelete={() => remove(p)} />)}
              </ul>
            </section>
          ))}
        </>
      )}

      {dialog && (
        <PlaceDialog place={dialog.place} countries={countries} onClose={() => setDialog(null)} onSave={save}
          countryHint={current && current.key ? { key: current.key, name: current.name, code: current.places[0].countryCode } : null} />
      )}
    </div>
  );
}

function PlaceCard({ place: p, onEdit, onDelete }) {
  const link = p.link ? parseLink(p.link) : null;
  const where = [p.city, !p.city && p.address].filter(Boolean)[0] || '';
  return (
    <li className="insp-card">
      <span className="ad-ico"><Icon name={p.cat} /></span>
      <div className="insp-text">
        <div className="insp-name">{p.name}</div>
        {where && <div className="insp-where">{where}</div>}
        {p.note && <p className="insp-note">{p.note}</p>}
        <div className="insp-actions">
          {link && (
            <a className={'insp-chip' + (link.kind === 'instagram' ? ' is-ig' : '')} href={link.url} target="_blank" rel="noopener noreferrer">
              <Icon name={link.kind === 'instagram' ? 'instagram' : 'link'} />{link.kind === 'instagram' ? 'Instagram' : link.label}
            </a>
          )}
          <a className="insp-chip" href={mapsUrl(p)} target="_blank" rel="noopener noreferrer"><Icon name="Other" />Map</a>
          <button className="insp-chip insp-icon-chip" type="button" aria-label={'Edit ' + p.name} title="Edit" onClick={onEdit}><Icon name="edit" /></button>
        </div>
      </div>
      <button className="icon-btn del insp-del" type="button" aria-label={'Delete ' + p.name} onClick={onDelete}>✕</button>
    </li>
  );
}

function SetupOrError({ error, onRetry }) {
  if (error?.code === 'missing_table') {
    return (
      <div className="insp-empty-card">
        <p><strong>One-time setup needed.</strong></p>
        <p>Saved places need their own table in Supabase. Open your project's <strong>SQL Editor</strong>, paste the contents of <code>supabase/inspirations.sql</code> from the repo, and press <strong>Run</strong>. Then come back and try again.</p>
        <button className="btn" type="button" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  return (
    <div className="insp-empty-card">
      <p><strong>Your saved places couldn't be loaded.</strong></p>
      <p>{error?.code === 'network' ? "Couldn't reach the server. Check your connection." : error?.message || 'Something went wrong.'}</p>
      <button className="btn" type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}
