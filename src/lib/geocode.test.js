import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeResults, parseGoogleMapsUrl, parsePhoton } from './geocode.js';

test('a Photon feature becomes a place result', () => {
  const r = parsePhoton({ geometry: { coordinates: [101.65, 3.17] }, properties: { name: 'Jaslyn Cakes', street: 'Jalan Kiara', housenumber: '5', city: 'Kuala Lumpur', country: 'Malaysia', countrycode: 'MY', osm_key: 'amenity', osm_value: 'cafe' } });
  assert.deepEqual([r.name, r.city, r.country, r.countryCode, r.lat, r.lng, r.cat], ['Jaslyn Cakes', 'Kuala Lumpur', 'Malaysia', 'my', 3.17, 101.65, 'Café']);
  assert.match(r.addr, /5 Jalan Kiara, Kuala Lumpur, Malaysia/);
});

test('results from two sources are merged without repeating a place', () => {
  const a = [{ name: 'Ichiran Shibuya', lat: 35.6612, lng: 139.7006 }];
  const b = [{ name: 'Ichiran', lat: 35.6613, lng: 139.7007 }, { name: 'Ichiran Roppongi', lat: 35.66, lng: 139.73 }];
  assert.deepEqual(mergeResults([a, b]).map((r) => r.name), ['Ichiran Shibuya', 'Ichiran Roppongi']);
  assert.equal(mergeResults([a, b], 1).length, 1);
});

test('Google Maps links are read for the place and its position', () => {
  const full = parseGoogleMapsUrl('https://www.google.com/maps/place/Petronas+Twin+Towers/@3.1579,101.7116,17z/data=!3m1!4b1!4m6!3m5!1s0x31cc37d:0x1!8m2!3d3.1578!4d101.7117');
  assert.deepEqual(full, { name: 'Petronas Twin Towers', lat: 3.1578, lng: 101.7117 });
  assert.deepEqual(parseGoogleMapsUrl('https://www.google.com/maps/place/Jaslyn+Cakes/@3.17,101.65,17z'), { name: 'Jaslyn Cakes', lat: 3.17, lng: 101.65 });
  assert.deepEqual(parseGoogleMapsUrl('https://www.google.com/maps/search/BAB+shawarma+Kuala+Lumpur'), { name: 'BAB shawarma Kuala Lumpur', lat: null, lng: null });
  assert.deepEqual(parseGoogleMapsUrl('https://maps.google.com/?q=3.17,101.65'), { name: '', lat: 3.17, lng: 101.65 });
  assert.deepEqual(parseGoogleMapsUrl('https://maps.app.goo.gl/abc123'), { short: true });
  assert.equal(parseGoogleMapsUrl('Jaslyn Cakes'), null);
  assert.equal(parseGoogleMapsUrl('https://www.google.com/search?q=cafe'), null);
  assert.equal(parseGoogleMapsUrl('https://www.instagram.com/p/ABC/'), null);
});
