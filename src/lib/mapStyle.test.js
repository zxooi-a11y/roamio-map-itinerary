import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEAFLET_TILE_URL, snapshotTileUrl } from './mapStyle.js';
import { snapshot } from './tiles.js';

test('map tiles come from the clean basemap, for the map and the snapshots alike', () => {
  assert.match(LEAFLET_TILE_URL, /^https:\/\/\{s\}\.basemaps\.cartocdn\.com\/light_all\/\{z\}\/\{x\}\/\{y\}\{r\}\.png$/);
  assert.equal(snapshotTileUrl(12, 2000, 1544), 'https://a.basemaps.cartocdn.com/light_all/12/2000/1544.png'); // 1x outside a browser
  const { tiles } = snapshot({ lat: 38.7, lng: -9.14, z: 12, w: 240, h: 140 });
  assert.ok(tiles.length > 0 && tiles.every((t) => t.src.includes('basemaps.cartocdn.com/light_all/12/')));
});
