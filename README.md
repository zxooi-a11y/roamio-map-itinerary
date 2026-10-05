# Roamio: map itinerary planner

Plan trips day by day on a map. You can search for places, put stops in order by dragging them, see walking, cycling or driving routes, and count down to your next trip. Trips are saved to a Supabase database, so the same trips are there on every device you open the site on. There is no sign-in.

Built with React and Vite. Maps use [Leaflet](https://leafletjs.com) with the clean Mapbox Light basemap when a Mapbox token is set (otherwise a similar free CARTO basemap). See the "Map style" section. Place search uses Nominatim, routes use OSRM or Valhalla, and destination photos come from Wikipedia.

## Changing a trip's dates

The start and end date sit under the trip title on the itinerary page. Editing either one adds, removes or moves days to match:

- Extending the start earlier or the end later adds empty days; existing days keep their calendar dates.
- Shortening removes the days outside the new range. If any of them have stops, you're asked to confirm first.
- Moving the start after the end (or the end before the start) moves the whole trip: same length, same days.
- A trip with no dates yet takes them from whichever field you fill in, keeping its number of days.
- Trips are limited to 60 days. The rules and their tests are in `src/lib/tripDates.js`.

## Import locations from a file

When creating a trip you can upload a **CSV**, **XLSX** or **Markdown** file of places.

- **CSV / XLSX:** one place per row; the first row names the columns: `name`, `address`, `day` (1, 2, 3… or a date), `time`, `type`, `notes`, `lat`, `lng`. Only the name is required, and columns can be in any order. Only the first sheet of a workbook is read.
- **Markdown:** bullet or numbered lists under headings such as `## Day 1` or `## 2026-07-02` (`- 09:00 Belém Tower – book ahead`), or pipe tables using the same column names.
- Rows with `lat` and `lng` are used as they are. Others are looked up by name (biased to the trip's destination) at one per second, following Nominatim's usage policy. Places that can't be found are added at the destination with a note, so you can drag them into place.
- If you don't enter trip dates, dates found in the file are used. Day numbers become days of the trip.
- Limits: 5 MB, 200 locations. Old `.xls` files aren't supported yet; save them as `.xlsx` or `.csv`.

A sample file is at `public/sample-locations.csv`. The parsers live in `src/lib/import/`.

## Map style

With a Mapbox public token the maps use Mapbox Light; without one they fall back to CARTO Positron, which looks similar. The token is not stored in the repo (GitHub blocks pushes that contain it). It's read at build time from `VITE_MAPBOX_TOKEN`:

- **Live site:** add a repository secret named `VITE_MAPBOX_TOKEN` (Settings → Secrets and variables → Actions → New repository secret), then re-run the deploy workflow.
- **Developing:** create `.env.local` containing `VITE_MAPBOX_TOKEN=pk....` (it's git-ignored).

Restrict the token to the site's address in your Mapbox account (Tokens → URL restrictions). Style and fallback are configured in `src/lib/mapStyle.js`.

## Storage

Trips are stored in the Supabase project `roamio-map-itinerary` (table `public.trips`, one JSON document per trip). There are no accounts: the site uses the public key, so **anyone who has the site can read and change the trips**. That's fine for a personal planner. To make a change you'd need access to the table, e.g. by tightening the row-level-security policy. Never commit the project's secret / `service_role` key.

The table is defined by `supabase/trips.sql`.

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
    tripDates.js           what changing the start / end date does to a trip's days (unit-tested)
    categories.js          stop categories + guessing from OSM data / names
    routing.js             route providers, cache and subscription
    geocode.js             Nominatim search + result parsing
    photos.js              Wikipedia destination photo, image cropping
    mapStyle.js            the basemap (one place for the interactive map and the snapshots)
    tiles.js               static map snapshots (covers, thumbnails)
    cloud.js               Supabase: load / save / delete trips
    supabaseConfig.js      project URL + publishable key
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
