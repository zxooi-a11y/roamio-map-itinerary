import { codeForName, countryName } from './inspiration.js';

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

/**
 * One landmark-style picture for a folder, found from the folder's NAME only (not its places): the Wikipedia article
 * "Tourism in <name>" usually opens with the best-known view, then the article for <name> itself.
 * '' when nothing is found (the caller shows a map of the places instead).
 */
export async function fetchFolderCover(folderName) {
  const name = String(folderName || '').trim();
  if (!name) return '';
  const code = codeForName(name);
  const full = code ? countryName({ countryCode: code }) || name : name; // "UK" -> "United Kingdom"
  for (const term of [`Tourism in ${full}`, `${full} landmark`, full, name]) {
    const src = await wikipediaPhotoFor({ name: term });
    if (src) return src;
  }
  return '';
}
