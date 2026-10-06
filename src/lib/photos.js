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

/** 1. A Wikimedia Commons photo taken within ~250 m of the place. */
export function commonsPhotoNear(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return Promise.resolve('');
  return once(`c:${lat.toFixed(4)},${lng.toFixed(4)}`, async () => {
    const j = await getJson('https://commons.wikimedia.org/w/api.php?' + query({
      action: 'query', generator: 'geosearch', ggscoord: `${lat}|${lng}`, ggsradius: '250', ggslimit: '10', ggsnamespace: '6',
      prop: 'imageinfo', iiprop: 'url|mime', iiurlwidth: '600',
    }));
    const photo = Object.values(j.query?.pages || {})
      .map((p) => p.imageinfo?.[0]).filter((i) => i && i.mime === 'image/jpeg' && i.thumburl)[0];
    return photo?.thumburl || '';
  });
}

/** 2. The lead image of the Wikipedia article that best matches the place's name and city. */
export function wikipediaPhotoFor(place) {
  const term = [place.name, place.city || place.country].filter(Boolean).join(' ').trim();
  if (!term) return Promise.resolve('');
  return once('w:' + term, async () => {
    const j = await getJson('https://en.wikipedia.org/w/api.php?' + query({
      action: 'query', generator: 'search', gsrlimit: '3', gsrsearch: term,
      prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '600', pilicense: 'any',
    }));
    return Object.values(j.query?.pages || {}).filter((p) => p.thumbnail?.source).sort((a, b) => a.index - b.index)[0]?.thumbnail.source || '';
  });
}

/** 3. The thumbnail of a saved TikTok video (TikTok's public oEmbed). */
export function tiktokThumbnail(link) {
  if (!link || !/tiktok\.com/i.test(link)) return Promise.resolve('');
  return once('t:' + link, async () => (await getJson('https://www.tiktok.com/oembed?url=' + encodeURIComponent(link))).thumbnail_url || '');
}

/**
 * One picture for a folder: goes through its places in order and, for each, tries the sources above;
 * the first photo found is the cover. '' when nothing is found (the caller shows a map instead).
 */
export async function fetchFolderCover(places) {
  for (const p of places.slice(0, 8)) {
    for (const step of [() => commonsPhotoNear(p.lat, p.lng), () => wikipediaPhotoFor(p), () => tiktokThumbnail(p.link)]) {
      const src = await step();
      if (src) return src;
    }
  }
  return '';
}
