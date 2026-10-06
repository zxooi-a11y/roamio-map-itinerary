/** A lead photo for a trip's destination from Wikipedia, or '' if none is found. */
export async function fetchDestinationPhoto(trip) {
  const term = (trip.place || trip.title || '').split(',')[0].trim();
  if (!term) return '';
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*',
    generator: 'search', gsrlimit: '4', gsrsearch: term,
    prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '1400', pilicense: 'any',
  });
  const res = await fetch('https://en.wikipedia.org/w/api.php?' + params);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const pages = Object.values((await res.json()).query?.pages || {})
    .filter((p) => p.thumbnail?.source)
    .sort((a, b) => a.index - b.index);
  return pages[0]?.thumbnail.source || '';
}

/** Read an image file and crop it to a centred square JPEG data URL of size × size px. */
export function squareThumbnail(file, size) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const side = Math.min(img.width, img.height);
      canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

// ---- Cover photos for saved places: free sources, tried in order until one has a picture ----

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make().catch(() => '').then((v) => { if (!v) cache.delete(key); return v; }));
  return cache.get(key);
};
const getJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
};
const query = (o) => new URLSearchParams({ format: 'json', origin: '*', ...o });

const raster = (src) => src && !/\.svg/i.test(src);
const pageImage = (j) => Object.values(j.query?.pages || {}).filter((p) => raster(p.thumbnail?.source)).sort((a, b) => a.index - b.index)[0]?.thumbnail.source || '';

/** A. The lead image of the Wikipedia article that best matches a name (and its city / country): the place's own landmark photo. */
export function wikipediaPhotoFor(place) {
  const term = [place.name, place.city || place.country].filter(Boolean).join(' ').trim();
  if (!term) return Promise.resolve('');
  return once('w:' + term, async () => pageImage(await getJson('https://en.wikipedia.org/w/api.php?' + query({
    action: 'query', generator: 'search', gsrlimit: '3', gsrsearch: term,
    prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '600', pilicense: 'any',
  }))));
}

/** B. The lead image of the nearest Wikipedia article about something within ~600 m (a landmark close by). */
export function landmarkNear(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return Promise.resolve('');
  return once(`n:${lat.toFixed(3)},${lng.toFixed(3)}`, async () => pageImage(await getJson('https://en.wikipedia.org/w/api.php?' + query({
    action: 'query', generator: 'geosearch', ggscoord: `${lat}|${lng}`, ggsradius: '600', ggslimit: '10',
    prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '600', pilicense: 'any',
  }))));
}

/** D. The thumbnail of a saved TikTok video (TikTok's public oEmbed). */
export function tiktokThumbnail(link) {
  if (!link || !/tiktok\.com/i.test(link)) return Promise.resolve('');
  return once('t:' + link, async () => (await getJson('https://www.tiktok.com/oembed?url=' + encodeURIComponent(link))).thumbnail_url || '');
}

const SIGHTS = ['Landmark', 'Museum', 'Park'];
const firstOf = async (steps) => {
  for (const step of steps) { const src = await step(); if (src) return src; }
  return '';
};
const mostCommon = (values) => {
  const n = new Map();
  for (const v of values.filter(Boolean)) n.set(v, (n.get(v) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
};

/**
 * One picture for a folder, aiming for a landmark rather than a random snapshot. Only sights (landmarks, museums,
 * parks) are looked up by name, since a café's name would match unrelated articles. In order, the first picture wins:
 *   1. the Wikipedia article for each sight (its own landmark photo)
 *   2. the nearest landmark's article, for each sight
 *   3. the article for the folder's main city, then its country (a skyline or famous view)
 *   4. a saved TikTok's thumbnail
 * '' when nothing is found (the caller shows a map).
 */
export async function fetchFolderCover(places) {
  const ordered = places.slice(0, 12);
  const sights = ordered.filter((p) => SIGHTS.includes(p.cat));
  const photo = await firstOf([
    ...sights.map((p) => () => wikipediaPhotoFor(p)),
    ...sights.map((p) => () => landmarkNear(p.lat, p.lng)),
    () => { const city = mostCommon(places.map((p) => p.city)); return city ? wikipediaPhotoFor({ name: city, country: mostCommon(places.map((p) => p.country)) }) : ''; },
    () => { const country = mostCommon(places.map((p) => p.country)); return country ? wikipediaPhotoFor({ name: country }) : ''; },
    ...ordered.map((p) => () => tiktokThumbnail(p.link)),
  ]);
  return photo;
}
