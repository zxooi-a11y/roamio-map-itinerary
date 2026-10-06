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

const placePhotos = new Map();

/** A Wikipedia photo of a saved place (by name and city), or '' if none is found. Cached for the session. */
export function fetchPlacePhoto(place) {
  const term = [place.name, place.city || place.country].filter(Boolean).join(' ').trim();
  if (!term) return Promise.resolve('');
  if (!placePhotos.has(term)) {
    const params = new URLSearchParams({
      action: 'query', format: 'json', origin: '*',
      generator: 'search', gsrlimit: '3', gsrsearch: term,
      prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '480', pilicense: 'any',
    });
    placePhotos.set(term, fetch('https://en.wikipedia.org/w/api.php?' + params)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((j) => Object.values(j.query?.pages || {}).filter((p) => p.thumbnail?.source).sort((a, b) => a.index - b.index)[0]?.thumbnail.source || '')
      .catch(() => { placePhotos.delete(term); return ''; }));
  }
  return placePhotos.get(term);
}
