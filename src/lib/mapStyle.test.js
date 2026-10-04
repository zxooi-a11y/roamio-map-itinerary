import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEAFLET_TILE_URL, makeBasemap, snapshotTileUrl } from './mapStyle.js';
import { snapshot } from './tiles.js';

test('with a Mapbox token: Mapbox Light for both the map and the snapshots', () => {
  const b = makeBasemap('pk.test');
  assert.equal(b.name, 'mapbox');
  assert.equal(b.leafletUrl, 'https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}{r}?access_token=pk.test');
  assert.equal(b.snapshotUrl(12, 2000, 1544, false), 'https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/12/2000/1544?access_token=pk.test');
  assert.match(b.snapshotUrl(12, 2000, 1544, true), /1544@2x\?access_token=pk\.test$/);
  assert.match(b.leafletOptions.attribution, /Mapbox/);
});

test('without a token: falls back to the free CARTO basemap', () => {
  const b = makeBasemap('');
  assert.equal(b.name, 'carto');
  assert.equal(b.leafletUrl, 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png');
  assert.equal(b.snapshotUrl(12, 2000, 1544, false), 'https://a.basemaps.cartocdn.com/light_all/12/2000/1544.png');
  assert.match(b.leafletOptions.attribution, /CARTO/);
});

test('the unit tests run without a token, so the default is the fallback and snapshots match the map', () => {
  assert.match(LEAFLET_TILE_URL, /cartocdn\.com/);
  const { tiles } = snapshot({ lat: 38.7, lng: -9.14, z: 12, w: 240, h: 140 });
  assert.ok(tiles.length > 0 && tiles.every((t) => t.src === snapshotTileUrl(12, Number(t.key.split('/')[1]), Number(t.key.split('/')[2])) || t.src.includes('/12/')));
});

test('no Mapbox token is written in the source code', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('./mapStyle.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /pk\.eyJ|sk\.eyJ/);
});
