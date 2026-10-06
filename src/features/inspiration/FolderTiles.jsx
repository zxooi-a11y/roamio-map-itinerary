import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { MapSnapshot } from '../../components/MapSnapshot.jsx';
import { folderHref } from '../../hooks/useHashRoute.js';
import { plural } from '../../lib/dates.js';
import { folderFlag } from '../../lib/inspiration.js';
import { fetchPlacePhoto } from '../../lib/photos.js';

const MOSAIC = 4;

/** One picture for a place: its Wikipedia photo, else a small map of where it is, else an icon. */
function PlacePicture({ place }) {
  const [photo, setPhoto] = useState('');
  useEffect(() => {
    let live = true;
    fetchPlacePhoto(place).then((src) => { if (live) setPhoto(src); });
    return () => { live = false; };
  }, [place.name, place.city, place.country]);

  if (photo) return <img className="ft-img" src={photo} alt="" loading="lazy" draggable="false" onError={() => setPhoto('')} />;
  if (place.lat !== null && place.lat !== undefined && place.lng !== null && place.lng !== undefined) {
    return (
      <span className="ft-map">
        <MapSnapshot points={[]} center={{ lat: place.lat, lng: place.lng }} w={240} h={240} pin className="ft-map-in" />
      </span>
    );
  }
  return <span className="ft-ph"><Icon name={place.cat} /></span>;
}

/** Big boxes, one per folder, each a collage of its places. Opening one goes to the folder's page. */
export function FolderTiles({ folders, places, unfiled }) {
  const tiles = folders.map((f) => ({ id: f.id, name: f.name, items: places.filter((p) => p.folderId === f.id) }));
  if (unfiled.length && unfiled.length < places.length) tiles.push({ id: '-', name: 'Not in a folder', items: unfiled, plain: true });
  return (
    <section className="ft-wrap" aria-label="Folders">
      <ul className="ft-grid">
        {tiles.map((t) => {
          const shown = t.items.slice(0, MOSAIC);
          return (
            <li key={t.id}>
              <a className={'ft-tile' + (t.plain ? ' is-plain' : '')} href={folderHref(t.id)}>
                <span className={'ft-mosaic n' + shown.length}>
                  {shown.length
                    ? shown.map((p) => <span className="ft-cell" key={p.id}><PlacePicture place={p} /></span>)
                    : <span className="ft-empty"><Icon name="folder" /></span>}
                </span>
                <span className="ft-label">
                  <span className="ft-name">{t.plain ? '' : folderFlag(t.id, places) + ' '}{t.name}</span>
                  <span className="ft-count">{t.items.length ? plural(t.items.length, 'place') : 'Empty'}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
