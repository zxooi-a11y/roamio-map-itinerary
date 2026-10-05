// Line icons (24×24, stroked). Category names double as icon names.
const PATHS = {
  Landmark: 'M3 21h18M5 10v11M9 10v11M15 10v11M19 10v11M2 10l10-6 10 6z',
  Restaurant: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3.5 3.5-3.5 7 0 1.5 1 2.5 3.5 2.5',
  'Café': 'M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3',
  Museum: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M8.5 9h.01',
  Park: 'M12 22v-6M12 16c-4 0-6-2.5-6-5.5 0-2 1-3 2-3.5C8 4.5 9.5 2 12 2s4 2.5 4 5c1 .5 2 1.5 2 3.5 0 3-2 5.5-6 5.5z',
  Shopping: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
  Hotel: 'M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-8v5M7 11a1.5 1.5 0 1 0 .01 0',
  Nightlife: 'M5 4h14l-7 8zM12 12v8M8 20h8',
  Transport: 'M7 3h10a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2zM5 11h14M8 21l2-3M16 21l-2-3M8.5 14.5h.01M15.5 14.5h.01',
  Other: 'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 1 0 .01 0',
  chevron: 'M6 9l6 6 6-6',
  instagram: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 8.5a3.5 3.5 0 1 0 .01 0M17.5 6.5h.01',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  back: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  foot: 'M13 3a1.7 1.7 0 1 0 .01 0M10 21l2.5-6-2.5-2.5 1-5 3.5 2 3 .5M10 8.5l-3 3M12.5 15l3 2.5.5 3.5',
  bike: 'M5.5 12.5a3.5 3.5 0 1 0 .01 0M18.5 12.5a3.5 3.5 0 1 0 .01 0M5.5 16L9 8h5l4.5 8M9 8l3.5 8H5.5M14 8l-1.5 8M14 6h2.5',
  car: 'M3 17v-4l2.2-5A2 2 0 0 1 7 7h10a2 2 0 0 1 1.8 1L21 13v4zM3 13h18M7 17v2M17 17v2M7.5 15h.01M16.5 15h.01',
};

export function Icon({ name, className = 'ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name] || PATHS.Other} />
    </svg>
  );
}
