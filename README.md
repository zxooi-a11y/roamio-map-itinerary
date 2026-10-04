# Roamio: map itinerary planner

Plan trips day by day on a map. You can search for places, put stops in order by dragging them, see walking, cycling or driving routes, and count down to your next trip. Trips are saved to a Supabase database, so they are still there next time you open the site.

Built with React and Vite. Maps use [Leaflet](https://leafletjs.com) with OpenStreetMap tiles. Place search uses Nominatim, routes use OSRM or Valhalla, and destination photos come from Wikipedia.

## Import locations from a file

When creating a trip you can upload a **CSV**, **XLSX** or **Markdown** file of places.

- **CSV / XLSX:** one place per row; the first row names the columns: `name`, `address`, `day` (1, 2, 3… or a date), `time`, `type`, `notes`, `lat`, `lng`. Only the name is required, and columns can be in any order. Only the first sheet of a workbook is read.
- **Markdown:** bullet or numbered lists under headings such as `## Day 1` or `## 2026-07-02` (`- 09:00 Belém Tower – book ahead`), or pipe tables using the same column names.
- Rows with `lat` and `lng` are used as they are. Others are looked up by name (biased to the trip's destination) at one per second, following Nominatim's usage policy. Places that can't be found are added at the destination with a note, so you can drag them into place.
- If you don't enter trip dates, dates found in the file are used. Day numbers become days of the trip.
- Limits: 5 MB, 200 locations. Old `.xls` files aren't supported yet; save them as `.xlsx` or `.csv`.

A sample file is at `public/sample-locations.csv`. The parsers live in `src/lib/import/`.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # unit tests (Node's built-in test runner)
npm run build     # production build in dist/
```

## Deploy

`.github/workflows/deploy.yml` builds and publishes the site to GitHub Pages on every push to `main`. You can also start it by hand from the Actions tab. To enable it the first time, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

The app uses hash routes (`#/trip/<id>`) and relative asset paths, so it works under `https://<user>.github.io/<repo>/` with no extra configuration.

## How the code is organised

```
src/
  main.jsx                 entry: providers + global styles
  App.jsx                  picks Home or Trip view from the URL hash

  lib/                     pure logic: no React, unit-tested
    trips.js               data model, trip phase/sorting/summary helpers, makeTrip, normalizeStore
    dates.js               "YYYY-MM-DD" helpers and formatting
    categories.js          stop categories + guessing from OSM data / names
    routing.js             route providers, cache and subscription
    geocode.js             Nominatim search + result parsing
    photos.js              Wikipedia destination photo, image cropping
    tiles.js               static OSM map snapshots (covers, thumbnails)
    cloud.js               Supabase: anonymous session, load / save / delete trips
    supabaseConfig.js      project URL + publishable key (safe to publish; row-level security guards the data)
    import/                import a file of locations: parse.js (CSV, Markdown, rows), readFile.js (file → places,
                           xlsx), resolve.js (look up coordinates), buildTrip.js (places → trip)
    theme.js               per-day colours

  store/
    tripsReducer.js        every change to trip data, as named actions (unit-tested)
    diffTrips.js           what changed since the last save (unit-tested)
    TripsProvider.jsx      React context: loads from the cloud, saves changes in the background

  hooks/                   useHashRoute, useRoute(s), usePlaceSearch, useCountdown, useToday
  components/              shared UI: Icon, MapSnapshot, Sheet (dialog), PlaceSearch, Toast

  features/home/           HomeView, Hero (countdown), TripCards, CreateTripDialog
  features/trip/           TripView, TripMap (Leaflet), DayCard, StopRow, DayThumb,
                           DayFilters, AddStopDialog, useStopDrag (drag-and-drop)

  styles/                  base.css (tokens, buttons), home.css, trip.css, dialog.css
```

How data flows: components never change trip data themselves. They `dispatch({ type: 'stop/move', … })` to the reducer, and `TripsProvider` saves the result. Route results live in a small cache outside React (`lib/routing.js`). Components read it with `useRoutes()`, which re-renders them when a route arrives.

Trips saved by the original single-file draft carry over, because the storage key (`itinerary-trips-v1`) is the same.
