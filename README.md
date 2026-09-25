# Solar Planner

A rooftop PV planner for sales consultants. Look up the customer's address, trace the roof faces on
satellite imagery, and the app lays out modules at the correct pitch and estimates yield, costs and
payback. You can then hand the customer a roof plan (PNG) and a proposal (PDF).

Built with SvelteKit 2 and Svelte 5, Leaflet via [sveaflet](https://github.com/sveaflet/sveaflet),
Tailwind 4 and daisyUI 5. It runs entirely on [Bun](https://bun.sh), both locally and on Vercel.

## Features

- **Customer first.** Enter a name and address. The address is geocoded with OpenStreetMap
  Nominatim, a pin marks the house, and the map flies there. By default the map starts in Stuttgart.
- **Roof drawing.** The first edge you draw is the eave, with the start point in red and the end point
  in green. While you draw, a live compass badge shows which way the face will point. Click the first
  point or press <kbd>Enter</kbd> to finish, <kbd>Backspace</kbd> to undo and <kbd>Esc</kbd> to cancel.
- **Correct module layout.** Each roof face gets one rigid grid aligned to its eave. Pitch
  foreshortens the up-slope dimensions by `cos(pitch)`, as seen from above. Modules only count if
  they fit completely inside the outline, and the grid offset that fits the most modules wins.
- **Yield.** Yields come from [PVGIS](https://re.jrc.ec.europa.eu/pvg_tools/) per roof (tilt and
  azimuth), fetched through a small Bun server route. Results are cached locally, and a simple model
  takes over when you are offline.
- **Economics.** Enter annual consumption (with hints for 1–5 person households), electricity price
  and feed-in tariff, plus an optional battery with capacity and price. The app shows autarky,
  self-consumption, annual benefit, payback and 20-year value.
- **Exports.**
  - PNG roof plan: a fixed 2400 × 1500 image on every device, showing roofs with area, facing and
    pitch.
  - A4 PDF proposal: branding, customer, the map, a roof table, economics, assumptions and the module
    spec, all as real text.
- **Branding.** Set a logo (with a crop picker), company, consultant and contact details on the
  settings page. They are stored in `localStorage`.
- **History.** "New customer" archives the current project. Old projects can be searched, reopened
  and deleted.
- **Sharp official aerial imagery.** In nine German states the map shows the survey offices'
  open-data orthophotos (10–40 cm per pixel) instead of global satellite imagery:
  Baden-Württemberg, Bavaria, Berlin/Brandenburg, Lower Saxony, Mecklenburg-Western Pomerania,
  North Rhine-Westphalia, Rhineland-Palatinate, Saxony and Thuringia. The app picks the services
  from simplified state outlines, and Esri World Imagery fills in everywhere else. Hessen, Hamburg,
  Bremen and Saarland have no suitable open service. Sachsen-Anhalt and Schleswig-Holstein have
  one, but it lacks the CORS headers the export needs. Sources are configured in
  `src/lib/map/imagery.ts`.
- **Imagery alignment.** Nudge the Esri layer by a few metres so it matches the street map. The
  official orthophotos are already exact and are not shifted.
- **German and English.** The language follows the browser, and you can override it in the settings
  ([Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs)).
- **Installable PWA.** It works offline once visited, and map tiles you have viewed are cached.
- **Privacy page (DSGVO).** There are no cookies and no tracking. Fonts are self-hosted, and all
  project data stays in the browser.

## Getting started

Requires [Bun](https://bun.sh) 1.4 or newer. Node.js is not needed.

```sh
bun install
bun run dev        # http://localhost:3021
```

| Script              | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `bun run dev`       | Vite dev server (on Bun)                                  |
| `bun run build`     | Production build into `build/`                            |
| `bun run start`     | Serve the production build with Bun                       |
| `bun run preview`   | Vite preview of the build                                 |
| `bun run check`     | `svelte-check` type checking                              |
| `bun run lint`      | Prettier and ESLint                                       |
| `bun run test:unit` | Unit tests for layout geometry and economics (`bun test`) |
| `bun run test:e2e`  | Playwright end-to-end tests (desktop and Pixel 7)         |
| `bun run test`      | Both                                                      |

Install the browser once before the first E2E run: `bunx playwright install chromium`. The suite
builds the app, serves it on port 4173 and mocks map tiles, Nominatim and PVGIS, so it runs offline.
To also hit the real PVGIS API, set `PVGIS=1`.

## Deployment

### Vercel

`vercel.json` pins `bunVersion`, so installs, builds and the server function all run on Bun. When the
`VERCEL` environment variable is present, `svelte.config.js` switches to `@sveltejs/adapter-vercel`
with the `experimental_bun1.x` runtime. No further setup is needed.

### Docker / self-hosted

Without `VERCEL`, the app builds with `svelte-adapter-bun`:

```sh
docker build -t solar-planner .
docker run -p 3000:3000 solar-planner
```

Or, without Docker: `bun run build && bun run start`.

## Before going live

Fill in the operator details (name, address, contact) in `src/lib/legal.ts`. Until then, the privacy
page shows a warning. Also review the privacy text in `src/routes/privacy/+page.svelte` against your
actual hosting setup.

## Project structure

```
src/
  routes/
    +page.svelte          planner: map, drawing, sidebar, exports
    api/yield/+server.ts  PVGIS proxy (PVGIS has no CORS)
    history/              archived customers
    settings/             language, branding, app install
    privacy/              DSGVO / GDPR notice
  lib/
    solar/layout.ts       roof projection, grid packing, azimuth
    solar/economics.ts    self-consumption, battery, payback
    solar/yield.ts        PVGIS client, cache, offline estimate
    map/imagery.ts        state orthophoto services and which ones cover the view
    map/regions.ts        simplified state outlines (generated from BKG VG2500)
    report/pdf.ts         jsPDF proposal
    utils/screenshot.ts   html2canvas-pro map capture
    components/           roof card, economics panel, address search, logo cropper, UI kit
    branding.ts           branding and customer types and persistence
    projects.ts           current project and history
    language.ts           language override for Paraglide
messages/{en,de}.json     translations
e2e/                      Playwright specs and fixtures
tests/unit/               bun test specs
```

## Translations

Strings live in `messages/en.json` and `messages/de.json`. Keep both files in sync. Paraglide
compiles them into `src/lib/paraglide/` (git-ignored) during dev and build. Use them in components as
`m.key({ ...params })`.

## Data sources

- Imagery: the official orthophotos of the German states (credited on the map and in the PDF), and
  Esri World Imagery elsewhere. Streets: © OpenStreetMap contributors.
- State outlines for choosing imagery: VG2500 © GeoBasis-DE / BKG (2024), dl-de/by-2-0.
- Geocoding: OpenStreetMap Nominatim, subject to its
  [usage policy](https://operations.osmfoundation.org/policies/nominatim/).
- Yields: PVGIS © European Union, JRC.
