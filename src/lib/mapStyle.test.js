import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basemapSelector, createBasemapSelector, makeBasemaps, snapshotTileUrl } from './mapStyle.js';
import { snapshot } from './tiles.js';

test('basemaps are tried in order: Mapbox (with a token), CARTO, then OpenStreetMap', () => {
  assert.deepEqual(makeBasemaps('pk.test').map((b) => b.name), ['mapbox', 'carto', 'osm']);
  assert.deepEqual(makeBasemaps('').map((b) => b.name), ['carto', 'osm']);
});

test('Mapbox tile URLs', () => {
  const [m] = makeBasemaps('pk.test');
  assert.equal(m.leafletUrl, 'https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}{r}?access_token=pk.test');
  assert.equal(m.snapshotUrl(12, 2000, 1544, false), 'https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/12/2000/1544?access_token=pk.test');
  assert.match(m.snapshotUrl(12, 2000, 1544, true), /1544@2x\?access_token=pk\.test$/);
  assert.match(m.leafletOptions.attribution, /Mapbox/);
});

test('CARTO and OpenStreetMap tile URLs', () => {
  const [carto, osm] = makeBasemaps('');
  assert.equal(carto.leafletUrl, 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png');
  assert.equal(carto.snapshotUrl(12, 2000, 1544, false), 'https://a.basemaps.cartocdn.com/light_all/12/2000/1544.png');
  assert.match(carto.leafletOptions.attribution, /CARTO/);
  assert.equal(osm.leafletUrl, 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  assert.equal(osm.snapshotUrl(12, 2000, 1544, true), 'https://tile.openstreetmap.org/12/2000/1544.png');
});

test('selector moves to the next basemap after 3 failures in a row, and tells subscribers', () => {
  const list = makeBasemaps('pk.test');
  const sel = createBasemapSelector(list, 3);
  let switches = 0;
  sel.subscribe(() => switches++);
  assert.equal(sel.current().name, 'mapbox');
  sel.note(false); sel.note(false);
  assert.equal(sel.current().name, 'mapbox');   // not yet
  sel.note(false);
  assert.equal(sel.current().name, 'carto');
  assert.equal(switches, 1);
  [false, false, false].forEach((ok) => sel.note(ok));
  assert.equal(sel.current().name, 'osm');
  [false, false, false, false, false, false].forEach((ok) => sel.note(ok));
  assert.equal(sel.current().name, 'osm');       // the last one is never abandoned
  assert.equal(switches, 2);
});

test('a success in between resets the failure count (a few missing tiles are not an outage)', () => {
  const sel = createBasemapSelector(makeBasemaps('pk.test'), 3);
  [false, false, true, false, false, true, false, false].forEach((ok) => sel.note(ok));
  assert.equal(sel.current().name, 'mapbox');
});

test('without a token the default selector starts on CARTO and snapshots match the map', () => {
  assert.equal(basemapSelector.current().name, 'carto');
  const { tiles } = snapshot({ lat: 38.7, lng: -9.14, z: 12, w: 240, h: 140 });
  assert.ok(tiles.length > 0 && tiles.every((t) => t.src.startsWith('https://a.basemaps.cartocdn.com/light_all/12/')));
  assert.match(snapshotTileUrl(1, 2, 3), /light_all\/1\/2\/3\.png$/);
});

test('no Mapbox token is written in the source code', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('./mapStyle.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /pk\.eyJ|sk\.eyJ/);
});
