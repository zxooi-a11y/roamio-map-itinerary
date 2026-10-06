// The best-known landmark of a country or city, as the title of its Wikipedia article.
// Folder covers use it: a folder named "Malaysia" gets a photo of the Petronas Towers.

const COUNTRIES = {
  ae: 'Burj Khalifa', ar: 'Perito Moreno Glacier', at: 'Schönbrunn Palace', au: 'Sydney Opera House', be: 'Grand-Place',
  bg: 'Rila Monastery', br: 'Christ the Redeemer (statue)', ca: 'CN Tower', ch: 'Matterhorn', cl: 'Torres del Paine National Park',
  cn: 'Great Wall of China', co: 'Walled City of Cartagena', cr: 'Arenal Volcano', cu: 'El Capitolio', cz: 'Charles Bridge',
  de: 'Brandenburg Gate', dk: 'Nyhavn', eg: 'Great Pyramid of Giza', es: 'Sagrada Família', fi: 'Helsinki Cathedral',
  fr: 'Eiffel Tower', gb: 'Big Ben', gr: 'Parthenon', hk: 'Victoria Peak', hr: 'Walls of Dubrovnik',
  hu: 'Hungarian Parliament Building', id: 'Borobudur', ie: 'Cliffs of Moher', il: 'Dome of the Rock', in: 'Taj Mahal',
  ir: 'Naqsh-e Jahan Square', is: 'Hallgrímskirkja', it: 'Colosseum', jo: 'Petra', jp: 'Mount Fuji', kh: 'Angkor Wat',
  kr: 'Gyeongbokgung', la: 'Pha That Luang', lk: 'Sigiriya', ma: 'Hassan II Mosque', mm: 'Shwedagon Pagoda', mx: 'Chichen Itza',
  my: 'Petronas Towers', nl: 'Canals of Amsterdam', no: 'Geirangerfjord', np: 'Mount Everest', nz: 'Milford Sound',
  pe: 'Machu Picchu', ph: 'Chocolate Hills', pk: 'Badshahi Mosque', pl: 'Wawel Castle', pt: 'Belém Tower', ro: 'Bran Castle',
  ru: "Saint Basil's Cathedral", sa: 'Kingdom Centre', se: 'Stockholm Palace', sg: 'Marina Bay Sands', th: 'Wat Arun',
  tr: 'Hagia Sophia', tw: 'Taipei 101', tz: 'Mount Kilimanjaro', us: 'Statue of Liberty', uz: 'Registan', vn: 'Hạ Long Bay',
  za: 'Table Mountain', zw: 'Victoria Falls',
};

const CITIES = {
  paris: 'Eiffel Tower', london: 'Big Ben', tokyo: 'Tokyo Tower', 'new york': 'Statue of Liberty', 'new york city': 'Statue of Liberty',
  'kuala lumpur': 'Petronas Towers', singapore: 'Marina Bay Sands', bangkok: 'Wat Arun', rome: 'Colosseum', barcelona: 'Sagrada Família',
  amsterdam: 'Canals of Amsterdam', berlin: 'Brandenburg Gate', istanbul: 'Hagia Sophia', dubai: 'Burj Khalifa', sydney: 'Sydney Opera House',
  'hong kong': 'Victoria Peak', seoul: 'Gyeongbokgung', kyoto: 'Fushimi Inari-taisha', osaka: 'Osaka Castle', lisbon: 'Belém Tower',
  prague: 'Charles Bridge', vienna: 'Schönbrunn Palace', venice: 'Grand Canal (Venice)', florence: 'Florence Cathedral',
  'san francisco': 'Golden Gate Bridge', 'los angeles': 'Hollywood Sign', 'las vegas': 'Las Vegas Strip', chicago: 'Cloud Gate',
  cairo: 'Great Pyramid of Giza', 'cape town': 'Table Mountain', 'rio de janeiro': 'Christ the Redeemer (statue)', bali: 'Uluwatu Temple',
  penang: 'Kek Lok Si', langkawi: 'Langkawi Sky Bridge', taipei: 'Taipei 101', shanghai: 'Oriental Pearl Tower', beijing: 'Forbidden City',
  hanoi: 'Hoan Kiem Lake', 'ho chi minh city': 'Saigon Notre-Dame Basilica', edinburgh: 'Edinburgh Castle', budapest: 'Hungarian Parliament Building',
  athens: 'Parthenon', santorini: 'Oia, Greece', moscow: "Saint Basil's Cathedral", mumbai: 'Gateway of India', delhi: 'India Gate',
  jaipur: 'Hawa Mahal', marrakech: 'Koutoubia Mosque', reykjavik: 'Hallgrímskirkja', copenhagen: 'Nyhavn', stockholm: 'Stockholm Palace',
  oslo: 'Oslo Opera House', geneva: 'Jet d\'Eau', melbourne: 'Flinders Street railway station', auckland: 'Sky Tower (Auckland)',
  toronto: 'CN Tower', 'mexico city': 'Angel of Independence', 'buenos aires': 'Obelisk of Buenos Aires',
};

/**
 * The Wikipedia article title of the best-known landmark for a folder name that is a country ("Malaysia", "UK",
 * "United States") or a well-known city ("Paris", "Kuala Lumpur"); '' when the name isn't one we know.
 * `codeForName` turns a country name into its ISO code.
 */
export function landmarkFor(name, codeForName) {
  const key = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return '';
  return CITIES[key] || COUNTRIES[codeForName(key)] || '';
}
