import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspirationReducer } from './inspirationReducer.js';
import { makePlace } from '../lib/inspiration.js';

test('add puts the newest first; update repairs and bumps updatedAt; remove; load replaces', () => {
  const a = makePlace({ name: 'Ichiran', countryCode: 'jp', country: 'Japan' });
  const b = makePlace({ name: 'teamLab', countryCode: 'jp', country: 'Japan' });
  let s = inspirationReducer([], { type: 'place/add', place: a });
  s = inspirationReducer(s, { type: 'place/add', place: b });
  assert.deepEqual(s.map((p) => p.name), ['teamLab', 'Ichiran']);
  const before = s;
  s = inspirationReducer(s, { type: 'place/update', id: a.id, patch: { note: 'Go at 2am', link: 'instagram.com/reel/X?igsh=1' } });
  const edited = s.find((p) => p.id === a.id);
  assert.deepEqual([edited.note, edited.link, edited.createdAt], ['Go at 2am', 'https://www.instagram.com/reel/X/', a.createdAt]);
  assert.ok(edited.updatedAt >= a.updatedAt);
  assert.equal(s[0], before[0]);                 // untouched place keeps its identity (no needless save)
  assert.equal(before[1].note, '');              // not mutated
  s = inspirationReducer(s, { type: 'place/remove', id: b.id });
  assert.deepEqual(s.map((p) => p.name), ['Ichiran']);
  assert.deepEqual(inspirationReducer(s, { type: 'load', items: [] }), []);
  assert.throws(() => inspirationReducer(s, { type: 'nope' }));
});

import { makeFolder, splitItems } from '../lib/inspiration.js';

test('folders: add, rename, move a place in and out, and delete without deleting the places', () => {
  const f = makeFolder('Japan'), g = makeFolder('Bali');
  const a = makePlace({ name: 'Ichiran' }), b = makePlace({ name: 'teamLab' }), c = makePlace({ name: 'Uluwatu' });
  let s = [a, b, c];
  s = inspirationReducer(s, { type: 'folder/add', folder: f });
  s = inspirationReducer(s, { type: 'folder/add', folder: g });
  assert.equal(splitItems(s).folders.length, 2);

  s = inspirationReducer(s, { type: 'place/update', id: a.id, patch: { folderId: f.id } });
  s = inspirationReducer(s, { type: 'place/update', id: b.id, patch: { folderId: f.id } });
  s = inspirationReducer(s, { type: 'place/update', id: c.id, patch: { folderId: g.id } });
  assert.deepEqual(splitItems(s).places.filter((p) => p.folderId === f.id).map((p) => p.name), ['Ichiran', 'teamLab']);

  s = inspirationReducer(s, { type: 'folder/rename', id: f.id, name: '  Japan 2027 ' });
  assert.equal(s.find((x) => x.id === f.id).name, 'Japan 2027');
  assert.equal(s.find((x) => x.id === a.id).folderId, f.id);   // renaming doesn't touch its places

  const before = s;
  s = inspirationReducer(s, { type: 'folder/remove', id: f.id });
  const { places, folders } = splitItems(s);
  assert.deepEqual(folders.map((x) => x.name), ['Bali']);
  assert.equal(places.length, 3);                               // no place was deleted
  assert.deepEqual(places.map((p) => p.folderId), ['', '', g.id]);
  assert.equal(s.find((x) => x.id === c.id), before.find((x) => x.id === c.id)); // an unrelated place keeps its identity

  // place/update can't be pointed at a folder by mistake
  assert.equal(inspirationReducer(s, { type: 'place/update', id: g.id, patch: { name: 'x' } }).find((x) => x.id === g.id).name, 'Bali');
});
