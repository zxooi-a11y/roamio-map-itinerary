# Roamio: map itinerary planner

Plan trips day by day on a map. You can search for places, put stops in order by dragging them, see walking, cycling or driving routes, and count down to your next trip. Trips are saved to a Supabase database, so the same trips are there on every device you open the site on. There is no sign-in.

Built with React and Vite. Maps use [Leaflet](https://leafletjs.com) with the clean Mapbox Light basemap when a Mapbox token is set (otherwise a similar free CARTO basemap). See the "Map style" section. Place search uses Nominatim, routes use OSRM or Valhalla, and destination photos come from Wikipedia.

## Inspiration: places saved for future travels

The **Inspiration** page (home page → Inspiration, or `#/inspiration`) keeps places you've found on Instagram, grouped by country, so before a trip you open that country and everything you've saved is there.

- **Save a place:** paste the post or reel link (share tracking like `?igsh=` is removed), search the place's name (this fills in the city, country and map location), add a note if you like. *Save & next* keeps the dialog open for the next place. A place that can't be found can be saved by name only.
- **Place search** looks in two free OpenStreetMap-based services at once, Nominatim and Photon, and merges the results (if one is down the other still answers). You can also paste a Google Maps link for the place (`google.com/maps/place/…`) into the search box and the name and position are read from it, no Google key involved; short `maps.app.goo.gl` links can't be read from a browser, so open one and copy the full address instead. The code is in `src/lib/geocode.js`.
- **Countries** are grouped by ISO code from the place search, so they stay together however the name is spelled; a typed country matching one you already use joins that group.
- On a country's page, searching for a new place is limited to that country (with a *Search everywhere* option).
- Each card links to the Instagram/TikTok post and to Google Maps (a search for the place's name and address, so it opens the actual place), has a *Preview* button that shows the post or reel right in the card (Instagram posts/reels and TikTok video links), and can be edited or deleted. A folder shows the flag of its country, and its page lists only its own places.
- **Send a link straight from Instagram:** the site can be opened as `<site address>/?link=<the link>` and goes to the Save dialog with it filled in. An iPhone Shortcut ("Save to Roamio", set up once; steps are in the *Send links straight from Instagram* panel on the page) uses this from Instagram's *Share to…* menu. On Android, installing the site as an app lists it in the Share menu directly (`public/manifest.webmanifest` declares the share target; `public/sw.js` makes it installable). iPhone Safari does not support web share targets, hence the shortcut. 
- **A link on its own is enough:** it's saved as "needs a place" and the card has an *Add place* button for later. The link logic is in `src/lib/shareIntake.js`.
- **Folders:** *New folder* (on the Inspiration page) makes a folder, e.g. "Food" or "Day trips", and opens it. On the main Inspiration page folders are big boxes, each with one cover picture: its picture is chosen from the folder's name, not its places: a folder named after a country or well-known city gets a photo of that place's best-known landmark (Malaysia → Petronas Towers, UK → Big Ben, Paris → Eiffel Tower), taken from the landmark's Wikipedia article. The list is in `src/lib/landmarks.js` (add your own there); other names fall back to a Wikipedia search for a famous landmark, then the article named after the folder (else a map of the places). The sources are in `src/lib/photos.js`; tap a box to open the folder's page with all its places and links. Each place card has a folder chip to move it (and the Save dialog has an optional Folder field; choose *+ New folder…* there to create one on the spot, named after the place's country by default); a folder's page (`#/inspiration/folder/<id>`) shows just its places, grouped by country, with *Rename* and *Delete folder*. Deleting a folder keeps its places and moves them back to *No folder*. Folder names are unique, ignoring case.
- Stored in the `inspirations` table (folders too, so no extra setup) in Supabase. **One-time setup:** run `supabase/inspirations.sql` in the Supabase SQL Editor. Until then the page explains this and the rest of the app works as normal.

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

The tables are defined by `supabase/trips.sql` and `supabase/inspirations.sql`.

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
    photos.js              Wikipedia destination photo, folder cover photos, image cropping
    landmarks.js           the best-known landmark of each country / big city, for folder covers
    mapStyle.js            the basemap (one place for the interactive map and the snapshots)
    tiles.js               static map snapshots (covers, thumbnails)
    cloud.js               Supabase: load / save / delete rows of any table (trips, inspirations)
    shareIntake.js         picks a shared link out of ?link= / ?url= / ?text=, opens the Save dialog with it (unit-tested)
    inspiration.js         saved places: link clean-up, grouping by country, search, map links (unit-tested)
    supabaseConfig.js      project URL + publishable key
    import/                import a file of locations: parse.js (CSV, Markdown, rows), readFile.js (file → places,
                           xlsx), resolve.js (look up coordinates), buildTrip.js (places → trip)
    theme.js               per-day colours

  store/
    tripsReducer.js        every change to trip data, as named actions (unit-tested)
    diffTrips.js           what changed since the last save (unit-tested)
    useSyncedCollection.js loads a table, saves changes in the background (batched, retried when offline)
    TripsProvider.jsx      trips, built on useSyncedCollection
    InspirationProvider.jsx saved places, built on useSyncedCollection; inspirationReducer.js has its actions

  hooks/                   useHashRoute, useRoute(s), usePlaceSearch, useCountdown, useToday
  components/              shared UI: Icon, MapSnapshot, Sheet (dialog), PlaceSearch, Toast

  features/home/           HomeView, Hero (countdown), TripCards, CreateTripDialog
  features/inspiration/    InspirationView (page), PlaceDialog (save / edit), FolderDialog (new / rename folder), FolderTiles (the folder boxes and their cover), InspirationTeaser (home section)
  features/trip/           TripView, TripMap (Leaflet), DayCard, StopRow, DayThumb,
                           DayFilters, AddStopDialog, useStopDrag (drag-and-drop)

  styles/                  base.css (tokens, buttons), home.css, trip.css, dialog.css
```

How data flows: components never change trip data themselves. They `dispatch({ type: 'stop/move', … })` to the reducer, and `TripsProvider` saves the result. Route results live in a small cache outside React (`lib/routing.js`). Components read it with `useRoutes()`, which re-renders them when a route arrives.

Trips saved by the original single-file draft carry over, because the storage key (`itinerary-trips-v1`) is the same.
