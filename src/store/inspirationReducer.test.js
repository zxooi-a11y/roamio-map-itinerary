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
