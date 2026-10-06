import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureSharedLink, extractUrl, linkFromParams, shareBaseUrl, takeSharedLink } from './shareIntake.js';

const IG = 'https://www.instagram.com/reel/C9xYz123AbC/';

test('extractUrl finds the link in a sentence and drops trailing punctuation', () => {
  assert.equal(extractUrl('Look at this https://www.instagram.com/p/AbC/?igsh=1 so good!'), 'https://www.instagram.com/p/AbC/?igsh=1');
  assert.equal(extractUrl('(see https://example.com/x)'), 'https://example.com/x');
  assert.equal(extractUrl('no link here'), '');
  assert.equal(extractUrl(null), '');
});

test('links arrive in ?link= (shortcuts, bookmarks)', () => {
  assert.equal(linkFromParams('?link=' + encodeURIComponent(IG + '?igsh=MWQ1')), IG);
  assert.equal(linkFromParams('?link=instagram.com/p/AbC'), 'https://www.instagram.com/p/AbC/'); // no https:// is fine
});

test('links arrive in ?url= or inside ?text= (Android share menu)', () => {
  assert.equal(linkFromParams('?title=Reel&url=' + encodeURIComponent(IG + '?igsh=x')), IG);
  assert.equal(linkFromParams('?text=' + encodeURIComponent('Amazing cafe ' + IG + '?igsh=x')), IG);
  assert.equal(linkFromParams('?url=&text=' + encodeURIComponent('hello ' + IG)), IG);
});

test('no link means nothing to do', () => {
  for (const q of ['', '?', '?foo=bar', '?text=just+words', '?link=not+a+link', '?url=javascript:alert(1)']) assert.equal(linkFromParams(q), '', q);
});

test('captureSharedLink remembers the link once, and cleans the address bar', () => {
  const calls = [];
  const hist = { replaceState: (...a) => calls.push(a) };
  assert.equal(captureSharedLink({ search: '?foo=1', pathname: '/x/' }, hist), false);
  assert.equal(calls.length, 0);
  assert.equal(captureSharedLink({ search: '?link=' + encodeURIComponent(IG), pathname: '/roamio-map-itinerary/' }, hist), true);
  assert.deepEqual(calls[0], [null, '', '/roamio-map-itinerary/#/inspiration']);
  assert.equal(takeSharedLink(), IG);
  assert.equal(takeSharedLink(), ''); // only once
});

test('the address for shortcuts is the site front page plus ?link=', () => {
  assert.equal(shareBaseUrl({ origin: 'https://me.github.io', pathname: '/roamio-map-itinerary/' }), 'https://me.github.io/roamio-map-itinerary/?link=');
  assert.equal(shareBaseUrl({ origin: 'https://me.github.io', pathname: '/roamio-map-itinerary/index.html' }), 'https://me.github.io/roamio-map-itinerary/?link=');
});
