export const CATEGORIES = ['Landmark', 'Restaurant', 'Café', 'Museum', 'Park', 'Shopping', 'Hotel', 'Nightlife', 'Transport', 'Other'];

/**
 * Best guess at a stop category, from an OpenStreetMap class/type when we have one
 * (search results), otherwise from words in the place name.
 */
export function guessCategory(name, osmClass, osmType) {
  const t = (osmType || '').toLowerCase();
  const k = (osmClass || '').toLowerCase();
  if (k === 'amenity') {
    if (/restaurant|fast_food|food_court|biergarten/.test(t)) return 'Restaurant';
    if (/cafe|ice_cream/.test(t)) return 'Café';
    if (/bar|pub|nightclub/.test(t)) return 'Nightlife';
    if (/place_of_worship|theatre|arts_centre/.test(t)) return 'Landmark';
    if (/marketplace/.test(t)) return 'Shopping';
  }
  if (k === 'tourism') {
    if (/museum|gallery/.test(t)) return 'Museum';
    if (/hotel|hostel|guest_house|motel|apartment/.test(t)) return 'Hotel';
    if (/attraction|viewpoint|artwork/.test(t)) return 'Landmark';
  }
  if (k === 'historic') return 'Landmark';
  if (k === 'leisure' || k === 'natural') return 'Park';
  if (k === 'shop') return 'Shopping';
  if (k === 'railway' || k === 'aeroway' || (k === 'highway' && /bus_stop/.test(t))) return 'Transport';

  const n = (name || '').toLowerCase();
  if (/restaurant|restaurante|bistro|trattoria|pizzeria|grill|diner|tavern|taberna|market|sushi|ramen|steakhouse/.test(n)) return 'Restaurant';
  if (/caf[eé]|coffee|bakery|pastelaria|patisserie|tea ?house/.test(n)) return 'Café';
  if (/museum|museu|gallery|galeria/.test(n)) return 'Museum';
  if (/park|garden|jardim|beach|praia|trail|lake|forest|cabo|cape|quinta/.test(n)) return 'Park';
  if (/hotel|hostel|inn\b|resort|b&b|guesthouse/.test(n)) return 'Hotel';
  if (/bar\b|pub\b|club|brewery|lounge/.test(n)) return 'Nightlife';
  if (/station|airport|estação|terminal|metro|port\b/.test(n)) return 'Transport';
  if (/mall|shop|store|outlet|factory|bookshop|livraria/.test(n)) return 'Shopping';
  if (/castle|castelo|palace|palácio|tower|torre|cathedral|sé\b|church|igreja|temple|monastery|mosteiro|square|praça|bridge|ponte|monument|miradouro|viewpoint/.test(n)) return 'Landmark';
  return 'Other';
}

/** The category a stop shows: its chosen one, or a guess from its name. */
export const categoryOf = (stop) => (CATEGORIES.includes(stop.cat) ? stop.cat : guessCategory(stop.name));
