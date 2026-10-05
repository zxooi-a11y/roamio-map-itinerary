import { normalizePlace } from '../lib/inspiration.js';

/** Every change to saved places (the Inspiration page). Never mutates; edits bump updatedAt. */
export function inspirationReducer(places, action) {
  switch (action.type) {
    case 'load': // { items } from the cloud
      return action.items;
    case 'place/add': // { place } newest first
      return [action.place, ...places];
    case 'place/update': // { id, patch }
      return places.map((p) => (p.id === action.id ? { ...normalizePlace({ ...p, ...action.patch }), updatedAt: Date.now() } : p));
    case 'place/remove': // { id }
      return places.filter((p) => p.id !== action.id);
    default:
      throw new Error('Unknown action: ' + action.type);
  }
}
