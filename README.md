# Roamio: map itinerary planner

Plan trips day by day on a map. You can search for places, put stops in order by dragging them, see walking, cycling or driving routes, and count down to your next trip. Everything is saved in your browser (localStorage), so you don't need an account or a server.

Built with React and Vite. Maps use [Leaflet](https://leafletjs.com) with OpenStreetMap tiles. Place search uses Nominatim, routes use OSRM or Valhalla, and destination photos come from Wikipedia.

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
    storage.js             localStorage load/save
    theme.js               per-day colours

  store/
    tripsReducer.js        every change to trip data, as named actions (unit-tested)
    TripsProvider.jsx      React context + auto-save

  hooks/                   useHashRoute, useRoute(s), usePlaceSearch, useCountdown, useToday
  components/              shared UI: Icon, MapSnapshot, Sheet (dialog), PlaceSearch, Toast

  features/home/           HomeView, Hero (countdown), TripCards, CreateTripDialog
  features/trip/           TripView, TripMap (Leaflet), DayCard, StopRow, DayThumb,
                           DayFilters, AddStopDialog, useStopDrag (drag-and-drop)

  styles/                  base.css (tokens, buttons), home.css, trip.css, dialog.css
```

How data flows: components never change trip data themselves. They `dispatch({ type: 'stop/move', … })` to the reducer, and `TripsProvider` saves the result. Route results live in a small cache outside React (`lib/routing.js`). Components read it with `useRoutes()`, which re-renders them when a route arrives.

Trips saved by the original single-file draft carry over, because the storage key (`itinerary-trips-v1`) is the same.
