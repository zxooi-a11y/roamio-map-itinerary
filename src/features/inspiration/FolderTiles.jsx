import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { MapSnapshot } from '../../components/MapSnapshot.jsx';
import { folderHref } from '../../hooks/useHashRoute.js';
import { plural } from '../../lib/dates.js';
import { folderFlag } from '../../lib/inspiration.js';
import { fetchFolderCover } from '../../lib/photos.js';

/** One cover for a folder: a photo of one of its places if any source has one, else a map of where they are, else an icon. */
function FolderCover({ items }) {
  const [photo, setPhoto] = useState('');
  const key = items.map((p) => p.id).join();
  useEffect(() => {
    let live = true;
    setPhoto('');
    if (items.length) fetchFolderCover(items).then((src) => { if (live) setPhoto(src); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (photo) return <img className="ft-img" src={photo} alt="" loading="lazy" draggable="false" onError={() => setPhoto('')} />;
  const points = items.filter((p) => p.lat !== null && p.lat !== undefined && p.lng !== null && p.lng !== undefined);
  if (points.length) {
    return (
      <span className="ft-map">
        <MapSnapshot points={points} w={360} h={360} maxZoom={13} className="ft-map-in" />
      </span>
    );
  }
  return <span className="ft-empty"><Icon name={items.length ? items[0].cat : 'folder'} /></span>;
}

/** Big boxes, one per folder, each with a single cover picture. Opening one goes to the folder's page. */
export function FolderTiles({ folders, places, unfiled }) {
  const tiles = folders.map((f) => ({ id: f.id, name: f.name, items: places.filter((p) => p.folderId === f.id) }));
  if (unfiled.length && unfiled.length < places.length) tiles.push({ id: '-', name: 'Not in a folder', items: unfiled, plain: true });
  return (
    <section className="ft-wrap" aria-label="Folders">
      <ul className="ft-grid">
        {tiles.map((t) => (
          <li key={t.id}>
            <a className={'ft-tile' + (t.plain ? ' is-plain' : '')} href={folderHref(t.id)}>
              <span className="ft-cover"><FolderCover items={t.items} /></span>
              <span className="ft-label">
                <span className="ft-name">{t.plain ? '' : folderFlag(t.id, places) + ' '}{t.name}</span>
                <span className="ft-count">{t.items.length ? plural(t.items.length, 'place') : 'Empty'}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
