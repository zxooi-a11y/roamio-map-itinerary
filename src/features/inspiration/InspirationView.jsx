import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { useToast } from '../../components/Toast.jsx';
import { folderHref, inspirationHref } from '../../hooks/useHashRoute.js';
import { plural } from '../../lib/dates.js';
import { folderOf, groupByCountry, makeFolder, makePlace, mapsUrl, parseLink, placesInFolder, searchPlacesList } from '../../lib/inspiration.js';
import { takeSharedLink } from '../../lib/shareIntake.js';
import { useInspiration } from '../../store/InspirationProvider.jsx';
import { FolderTiles } from './FolderTiles.jsx';
import { FolderDialog } from './FolderDialog.jsx';
import { PlaceDialog } from './PlaceDialog.jsx';
import { ShareHelp } from './ShareHelp.jsx';

/** The URL key of a country group; places with no country use "-". */
const routeKey = (g) => g.key || '-';
/** The folder page for places that aren't in any folder. */
const UNFILED = '-';
const countriesText = (n) => n + (n === 1 ? ' country' : ' countries');

/**
 * Places saved for future travels, grouped by country, and the folders they can be filed in.
 *   "#/inspiration"                every place, grouped by country
 *   "#/inspiration/<key>"          one country (key from countryKey: "jp", or a typed country name)
 *   "#/inspiration/folder/<id>"    one folder ("-" = places not in any folder)
 */
export function InspirationView({ country, folder: folderId = '', navigate }) {
  const { places, folders, dispatch, status, loadError, reload } = useInspiration();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(null);       // null | { place: null, link? } (new) | { place } (edit)
  const [folderDialog, setFolderDialog] = useState(null); // null | { folder: null } (new) | { folder } (rename)

  const inFolderView = Boolean(folderId);
  const folder = folderId && folderId !== UNFILED ? folders.find((f) => f.id === folderId) : null;
  const folderMissing = status === 'ready' && inFolderView && folderId !== UNFILED && !folder;
  // What this page lists: everything, or just what's in the folder
  const pagePlaces = useMemo(() => (!inFolderView ? places : placesInFolder(places, folders, folderId === UNFILED ? '' : folderId)),
    [places, folders, inFolderView, folderId]);

  const groups = useMemo(() => groupByCountry(pagePlaces), [pagePlaces]);
  const allGroups = useMemo(() => groupByCountry(places), [places]);
  const current = country && !inFolderView ? groups.find((g) => routeKey(g) === country) : null;
  const unfiledCount = useMemo(() => placesInFolder(places, folders, '').length, [places, folders]);

  useEffect(() => {
    const what = folder ? '📁 ' + folder.name : folderId === UNFILED ? 'Not in a folder' : current ? current.name : '';
    document.title = (what ? what + ' · ' : '') + 'Inspiration · Trip planner';
  }, [current, folder, folderId]);
  useEffect(() => { window.scrollTo(0, 0); setQuery(''); }, [country, folderId]);

  // A link sent from Instagram's share menu (or a shortcut) opens the Save dialog with it filled in.
  useEffect(() => {
    const link = takeSharedLink();
    if (link) setDialog({ place: null, link });
  }, []);

  const shown = (country && !inFolderView ? groups.filter((g) => routeKey(g) === country) : groups)
    .map((g) => ({ ...g, places: searchPlacesList(g.places, query) }))
    .filter((g) => g.places.length);

  const save = (fields, { another, newFolder }) => {
    if (newFolder) dispatch({ type: 'folder/add', folder: newFolder });
    if (dialog.place) {
      dispatch({ type: 'place/update', id: dialog.place.id, patch: fields });
      toast(`Saved changes to ${fields.name}.`);
    } else {
      dispatch({ type: 'place/add', place: makePlace(fields) });
      toast(fields.needsPlace ? 'Link saved. Add its place when you have a moment.' : `Saved ${fields.name}.`);
    }
    if (!another) setDialog(null);
  };
  const remove = (p) => {
    if (confirm(`Delete “${p.name}” from your saved places?`)) dispatch({ type: 'place/remove', id: p.id });
  };
  const moveTo = (p, folderIdToSet) => {
    dispatch({ type: 'place/update', id: p.id, patch: { folderId: folderIdToSet } });
    const target = folders.find((f) => f.id === folderIdToSet);
    toast(target ? `Moved “${p.name}” to ${target.name}.` : `Took “${p.name}” out of its folder.`);
  };

  const saveFolder = (name) => {
    if (folderDialog.folder) {
      dispatch({ type: 'folder/rename', id: folderDialog.folder.id, name });
      toast('Folder renamed.');
      setFolderDialog(null);
    } else {
      const created = makeFolder(name);
      dispatch({ type: 'folder/add', folder: created });
      toast(`Created the folder “${created.name}”.`);
      setFolderDialog(null);
      navigate?.(folderHref(created.id)); // open it, ready for places
    }
  };
  const deleteFolder = () => {
    const n = places.filter((p) => p.folderId === folder.id).length;
    const msg = n
      ? `Delete the folder “${folder.name}”? The ${plural(n, 'place')} in it will not be deleted; they'll just be out of any folder.`
      : `Delete the empty folder “${folder.name}”?`;
    if (!confirm(msg)) return;
    dispatch({ type: 'folder/remove', id: folder.id });
    toast('Folder deleted.');
    navigate?.(inspirationHref());
  };

  const title = folder ? `📁 ${folder.name}` : folderId === UNFILED ? 'Not in a folder'
    : current ? `${current.flag ? current.flag + ' ' : ''}${current.name}` : 'Inspiration';
  const countLine = inFolderView
    ? plural(pagePlaces.length, 'saved place') + (groups.length > 1 ? ` · ${countriesText(groups.length)}` : '')
    : current
      ? plural(current.places.length, 'saved place')
      : places.length ? `${plural(places.length, 'saved place')} · ${countriesText(groups.length)}` + (folders.length ? ` · ${plural(folders.length, 'folder')}` : '') : 'Places you want to visit one day';

  return (
    <div className="insp-wrap">
      <header className="insp-head">
        <a className="back" href={inFolderView ? inspirationHref() : current || country ? inspirationHref() : '#/'}>
          <Icon name="back" />{inFolderView ? 'All places' : current || country ? 'All countries' : 'All trips'}
        </a>
        <h1 className="insp-title">{title}</h1>
        <p className="subtitle">{countLine}</p>
        {folder && (
          <div className="insp-folder-actions">
            <button className="insp-chip" type="button" onClick={() => setFolderDialog({ folder })}><Icon name="edit" />Rename</button>
            <button className="insp-chip" type="button" onClick={deleteFolder}><Icon name="trash" />Delete folder</button>
          </div>
        )}
      </header>

      {status === 'loading' && <p className="insp-empty">Loading your saved places…</p>}
      {status === 'error' && <SetupOrError error={loadError} onRetry={reload} />}

      {status === 'ready' && (
        <>
          <div className="insp-toolbar">
            {places.length > 0 && (
              <label className="ad-search insp-search">
                <Icon name="search" />
                <input className="ad-in" type="search" placeholder={folder ? `Search ${folder.name}` : current ? `Search ${current.name}` : 'Search saved places'}
                  aria-label="Search saved places" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
            )}
            <button className="btn insp-add" type="button" onClick={() => setDialog({ place: null })}>
              <Icon name="plus" />Save a place
            </button>
            <button className="btn-plain insp-newfolder" type="button" onClick={() => setFolderDialog({ folder: null })}>
              <Icon name="folderPlus" />New folder
            </button>
          </div>

          {folders.length > 0 && !inFolderView && !country && !query.trim() && (
            <FolderTiles folders={folders} places={places} unfiled={placesInFolder(places, folders, '')} />
          )}
          {folders.length > 0 && (inFolderView || country || query.trim()) && (
            <nav className="insp-countries insp-folders" aria-label="Folders">
              <a className="chip" href={inspirationHref()} aria-current={!inFolderView && !country ? 'page' : undefined}>All · {places.length}</a>
              {folders.map((f) => (
                <a key={f.id} className="chip" href={folderHref(f.id)} aria-current={folderId === f.id ? 'page' : undefined}>
                  <Icon name="folder" />{f.name} · {places.filter((p) => p.folderId === f.id).length}
                </a>
              ))}
              {unfiledCount > 0 && unfiledCount < places.length && (
                <a className="chip" href={folderHref(UNFILED)} aria-current={folderId === UNFILED ? 'page' : undefined}>No folder · {unfiledCount}</a>
              )}
            </nav>
          )}

          {!inFolderView && allGroups.length > 1 && (
            <nav className="insp-countries" aria-label="Countries">
              <a className="chip" href={inspirationHref()} aria-current={!country ? 'page' : undefined}>All · {places.length}</a>
              {allGroups.map((g) => (
                <a key={routeKey(g)} className="chip" href={inspirationHref(routeKey(g))} aria-current={country === routeKey(g) ? 'page' : undefined}>
                  {g.flag && <span aria-hidden="true">{g.flag}</span>}{g.name} · {g.places.length}
                </a>
              ))}
            </nav>
          )}

          {places.length > 0 && !inFolderView && <ShareHelp />}
          {folderMissing && (
            <div className="insp-empty-card">
              <p><strong>This folder doesn't exist any more.</strong></p>
              <p><a href={inspirationHref()}>Back to all places</a></p>
            </div>
          )}
          {inFolderView && !folderMissing && !pagePlaces.length && (
            <div className="insp-empty-card">
              <Icon name="folder" />
              <p><strong>{folderId === UNFILED ? 'Every place is in a folder.' : 'Nothing in this folder yet.'}</strong></p>
              {folderId !== UNFILED && <p>Tap <em>Save a place</em> to add one straight into it, or open the folder chip on any saved place and choose this folder.</p>}
            </div>
          )}
          {!places.length && !inFolderView && (
            <div className="insp-empty-card">
              <Icon name="instagram" />
              <p><strong>Save places from Instagram for your future trips.</strong></p>
              <p>Copy a post or reel's link, tap <em>Save a place</em>, paste it and search the place's name. Places are grouped by country, so when you plan a trip everything you've saved for that country is in one spot.</p>
              <ShareHelp defaultOpen />
            </div>
          )}
          {pagePlaces.length > 0 && !shown.length && (
            <p className="insp-empty">{query ? `Nothing matches “${query}”.` : 'No saved places here.'}</p>
          )}

          {shown.map((g) => (
            <section key={routeKey(g)} className="insp-group" aria-label={g.name}>
              {(!country || inFolderView) && (
                <h2 className="insp-group-title">
                  {inFolderView
                    ? <span>{g.flag && <span aria-hidden="true">{g.flag} </span>}{g.name}</span>
                    : <a href={inspirationHref(routeKey(g))}>{g.flag && <span aria-hidden="true">{g.flag} </span>}{g.name}</a>}
                  <span className="sec-count">{g.places.length}</span>
                </h2>
              )}
              <ul className="insp-grid">
                {g.places.map((p) => (
                  <PlaceCard key={p.id} place={p} folders={folders} onEdit={() => setDialog({ place: p })} onDelete={() => remove(p)}
                    onMove={(id) => moveTo(p, id)} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {dialog && (
        <PlaceDialog place={dialog.place} initialLink={dialog.link} folders={folders}
          defaultFolderId={folder ? folder.id : ''} onClose={() => setDialog(null)} onSave={save}
          countryHint={current && current.key ? { key: current.key, name: current.name, code: current.places[0].countryCode } : null} />
      )}
      {folderDialog && <FolderDialog folder={folderDialog.folder} folders={folders} onClose={() => setFolderDialog(null)} onSave={saveFolder} />}
    </div>
  );
}

function PlaceCard({ place: p, folders, onEdit, onDelete, onMove }) {
  const link = p.link ? parseLink(p.link) : null;
  const inFolder = folderOf(p, folders);
  const where = p.needsPlace ? '' : [p.city, !p.city && p.address].filter(Boolean)[0] || '';
  return (
    <li className="insp-card">
      <span className="ad-ico"><Icon name={p.cat} /></span>
      <div className="insp-text">
        <div className="insp-name">{p.name}</div>
        {p.needsPlace && <div className="insp-where">Which place is this? Tap <strong>Add place</strong>.</div>}
        {where && <div className="insp-where">{where}</div>}
        {p.note && <p className="insp-note">{p.note}</p>}
        <div className="insp-actions">
          {link && (
            <a className={'insp-chip' + (link.kind === 'instagram' ? ' is-ig' : '')} href={link.url} target="_blank" rel="noopener noreferrer">
              <Icon name={link.kind === 'instagram' ? 'instagram' : 'link'} />{link.kind === 'instagram' ? 'Instagram' : link.label}
            </a>
          )}
          {p.needsPlace
            ? <button className="insp-chip is-todo" type="button" onClick={onEdit}><Icon name="plus" />Add place</button>
            : <a className="insp-chip" href={mapsUrl(p)} target="_blank" rel="noopener noreferrer"><Icon name="Other" />Map</a>}
          {folders.length > 0 && (
            <label className={'insp-chip insp-folder-chip' + (inFolder ? ' is-filed' : '')}>
              <Icon name="folder" /><span className="insp-folder-name">{inFolder ? inFolder.name : 'Folder'}</span>
              <select aria-label={`Folder for ${p.name}`} value={inFolder ? inFolder.id : ''} onChange={(e) => onMove(e.target.value)}>
                <option value="">No folder</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
          )}
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
