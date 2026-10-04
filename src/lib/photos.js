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
