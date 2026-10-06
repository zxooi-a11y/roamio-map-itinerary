import { isFolder, normalizeFolder, normalizePlace } from '../lib/inspiration.js';

/**
 * Every change to the Inspiration page's items: places and folders live in one list (told apart by `kind`).
 * Never mutates; edits bump updatedAt; items that don't change keep their identity (so they aren't re-saved).
 */
export function inspirationReducer(places, action) {
  switch (action.type) {
    case 'load': // { items } from the cloud
      return action.items;
    case 'place/add': // { place } newest first
      return [action.place, ...places];
    case 'place/update': // { id, patch }
      return places.map((p) => (p.id === action.id && !isFolder(p) ? { ...normalizePlace({ ...p, ...action.patch }), updatedAt: Date.now() } : p));
    case 'place/remove': // { id }
      return places.filter((p) => p.id !== action.id);

    case 'folder/add': // { folder }
      return [...places, action.folder];
    case 'folder/rename': // { id, name }
      return places.map((f) => (f.id === action.id && isFolder(f) ? { ...normalizeFolder({ ...f, name: action.name }), updatedAt: Date.now() } : f));
    case 'folder/remove': // { id } deletes the folder only; the places in it go back to "no folder"
      return places
        .filter((x) => !(isFolder(x) && x.id === action.id))
        .map((x) => (!isFolder(x) && x.folderId === action.id ? { ...x, folderId: '', updatedAt: Date.now() } : x));
    default:
      throw new Error('Unknown action: ' + action.type);
  }
}
