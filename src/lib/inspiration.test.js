import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryKey, flagEmoji, groupByCountry, makePlace, mapsUrl, normalizePlace, normalizePlaces, parseLink, searchPlacesList } from './inspiration.js';
import { parseResult } from './geocode.js';

test('Instagram links are cleaned of share tracking and labelled', () => {
  assert.deepEqual(parseLink('https://www.instagram.com/reel/C9xYz123AbC/?igsh=MWQ1ZGUxMzBkMA=='),
    { url: 'https://www.instagram.com/reel/C9xYz123AbC/', kind: 'instagram', label: 'Instagram reel' });
  assert.deepEqual(parseLink('instagram.com/p/ABC123?utm_source=ig_web_copy_link'),
    { url: 'https://www.instagram.com/p/ABC123/', kind: 'instagram', label: 'Instagram post' });
  assert.equal(parseLink('https://instagr.am/p/XYZ/').url, 'https://www.instagram.com/p/XYZ/');
  assert.equal(parseLink('https://m.instagram.com/tokyo.cafes/').label, '@tokyo.cafes');
  assert.equal(parseLink('  https://www.instagram.com/tv/ABC/  ').label, 'Instagram video');
});

test('other links are kept; junk is rejected', () => {
  assert.deepEqual(parseLink('https://vm.tiktok.com/ZMabc/?_r=1'), { url: 'https://vm.tiktok.com/ZMabc/', kind: 'tiktok', label: 'TikTok' });
  assert.equal(parseLink('https://www.timeout.com/tokyo/restaurants?x=1').label, 'timeout.com');
  assert.equal(parseLink('https://www.timeout.com/tokyo/restaurants?x=1').url, 'https://www.timeout.com/tokyo/restaurants?x=1');
  assert.equal(parseLink('not a link'), null);
  assert.equal(parseLink('javascript:alert(1)'), null);
  assert.equal(parseLink(''), null);
});

test('flags', () => {
  assert.equal(flagEmoji('jp'), '🇯🇵');
  assert.equal(flagEmoji('PT'), '🇵🇹');
  assert.equal(flagEmoji(''), '');
  assert.equal(flagEmoji('xyz'), '');
});

const P = (name, extra = {}) => normalizePlace({ id: name, name, createdAt: 1, ...extra });

test('places group by ISO country code, so different spellings of a country land together', () => {
  const places = [
    P('Ichiran', { country: 'Japan', countryCode: 'jp', createdAt: 1 }),
    P('teamLab', { country: '日本', countryCode: 'JP', createdAt: 3 }),
    P('Pastéis de Belém', { country: 'Portugal', countryCode: 'pt' }),
    P('Some bar', { country: '' }),
    P('Typed place', { country: 'Bali ' }),
  ];
  const groups = groupByCountry(places);
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
  assert.deepEqual(byKey.jp.places.map((p) => p.name), ['teamLab', 'Ichiran']); // newest first
  assert.equal(byKey.jp.flag, '🇯🇵');
  assert.equal(byKey.bali.places.length, 1);                                   // typed country, no code
  assert.equal(groups[groups.length - 1].key, '');                             // "No country" goes last
  assert.equal(groups[groups.length - 1].name, 'No country');
  assert.equal(countryKey(P('x', { countryCode: 'JP' })), 'jp');
});

test('search matches every word, ignoring accents and case', () => {
  const places = [P('Pastéis de Belém', { city: 'Lisbon', note: 'custard tarts' }), P('Time Out Market', { city: 'Lisbon' }), P('Ichiran', { city: 'Tokyo', note: 'ramen' })];
  assert.deepEqual(searchPlacesList(places, 'pasteis').map((p) => p.name), ['Pastéis de Belém']);
  assert.deepEqual(searchPlacesList(places, 'lisbon tarts').map((p) => p.name), ['Pastéis de Belém']);
  assert.equal(searchPlacesList(places, '  ').length, 3);
  assert.deepEqual(searchPlacesList(places, 'RAMEN').map((p) => p.name), ['Ichiran']);
});

test('maps link uses exact coordinates when known, else a name search', () => {
  assert.equal(mapsUrl(P('A', { lat: 35.6, lng: 139.7 })), 'https://www.google.com/maps/search/?api=1&query=35.6%2C139.7');
  assert.match(mapsUrl(P('Ichiran Shibuya', { city: 'Tokyo' })), /query=Ichiran%20Shibuya%2C%20Tokyo/);
});

test('normalizing repairs or drops bad data', () => {
  assert.equal(normalizePlace({ name: '  ' }), null);
  assert.equal(normalizePlace(null), null);
  const p = normalizePlace({ name: 'X', lat: 200, lng: 1, countryCode: 'japan', link: 'instagram.com/p/A?igsh=1', cat: 'Nope' });
  assert.deepEqual([p.lat, p.lng, p.countryCode, p.link, p.cat], [null, null, '', 'https://www.instagram.com/p/A/', 'Other']);
  assert.equal(normalizePlaces([{ name: 'a' }, null, { name: '' }, 'x']).length, 1);
  const made = makePlace({ name: 'Café Kitsuné', lat: '35.1', lng: '139.2' });
  assert.ok(made.id && made.createdAt > 0);
  assert.deepEqual([made.lat, made.cat], [35.1, 'Café']);
});

test('a link saved before its place is known is flagged and named after the link', () => {
  const p = makePlace({ name: 'Instagram reel', link: 'instagram.com/reel/AbC?igsh=1', needsPlace: true });
  assert.deepEqual([p.needsPlace, p.name, p.link, p.lat, p.country], [true, 'Instagram reel', 'https://www.instagram.com/reel/AbC/', null, '']);
  assert.equal(makePlace({ name: 'x' }).needsPlace, false);
});

test('place search results now carry city and ISO country code', () => {
  const r = parseResult({ name: 'Ichiran', display_name: 'Ichiran, Shibuya, Tokyo, Japan', lat: '35.66', lon: '139.70', category: 'amenity', type: 'restaurant',
    address: { city: 'Shibuya', country: 'Japan', country_code: 'jp' } });
  assert.deepEqual([r.city, r.country, r.countryCode, r.cat], ['Shibuya', 'Japan', 'jp', 'Restaurant']);
  const old = parseResult({ name: 'X', display_name: 'X, Lisbon, Portugal', lat: '1', lon: '2' });
  assert.deepEqual([old.country, old.countryCode, old.city], ['Portugal', '', '']);
});
