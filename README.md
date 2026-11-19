# PADDOCK

**The Past. The People. The Next Chapter.**

PADDOCK is an independent Formula 1 digital magazine: a museum of the sport's history (1950 to today), a gallery of the drivers who shaped it, and a statistical estimate of who wins the next Grand Prix.

| Page | What it does |
| --- | --- |
| **Home** | Editorial landing page that introduces the three pillars. |
| **History** | Decade-by-decade archive: defining moments, iconic cars, constructors, regulation changes, champions, and per-season standings and race winners. |
| **People** | THE GRID: every driver who has started a World Championship Grand Prix (793 so far), with filters, decade browsing, search, and magazine-style profiles with verified statistics and career timelines. |
| **Prediction** | Win probabilities for the next Grand Prix from a calibrated model, with explanations, a walk-forward backtest and a prediction-versus-result review. |

## Quick start

Requirements: **Node 18+** and, for the Prediction page, **Python 3** (tested on 3.13) with `pandas`, `numpy` and `scikit-learn`.

```bash
# 1. API (http://localhost:5001)
cd server
npm install
pip install pandas numpy scikit-learn      # only needed for predictions
npm start

# 2. Website (http://localhost:5173), in a second terminal
cd client
npm install
npm run dev
```

The first Prediction request downloads about 13 seasons of results and qualifying from Jolpica (roughly 130 throttled requests, one to two minutes). Everything is then cached, so later loads are fast.

### Production, one process

```bash
cd client && npm install && npm run build
cd ../server && npm install && npm start
```

When `client/dist` exists, the Express server serves the website and the API from the same origin (`/api`), so no CORS or proxy setup is needed. Set `PORT` in the host's environment if it assigns one. The host also needs Python with the three libraries for predictions; without them the site still works and the Prediction page says the model is unavailable (see below).

## Configuration

`server/.env` (no secrets are needed; Jolpica is public):

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `5001` | API port. (macOS uses 5000 for AirPlay, so it is avoided.) |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Extra origin(s) allowed by CORS, comma separated. `https://paddock-self.vercel.app` is always allowed. |
| `JOLPICA_BASE_URL` | `https://api.jolpi.ca/ergast/f1` | Data source. |
| `PYTHON_BIN` | `python3` | Interpreter for the model. |
| `MODEL_FIRST_SEASON` | `2014` | First season used for model history. |
| `BACKTEST_FIRST_SEASON` | `2022` | First season of the backtest. |

The client reads the optional `VITE_API_URL` (defaults to `http://localhost:5001/api` in development and the deployed backend, `https://paddock-2ai7.vercel.app/api`, in production). It holds no keys.

## API

All responses are `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "status", "message" } }`.

| Route | Description |
| --- | --- |
| `GET /api/history` | Curated decades: moments, cars, constructors, regulations, image credits. |
| `GET /api/history/seasons` | Every season with its champions (plus any in-progress season). |
| `GET /api/history/:season` | Season detail: champions, top-10 standings, every race winner. |
| `GET /api/people?filter=&decade=&search=&page=&limit=&sort=` | The driver archive, paginated. `filter`: `all`, `current`, `champions`, `retired`. `decade`: `1950s` to `2020s`. `sort`: `notable` (default), `name`, `career`. Returns `items`, `total`, `facets` (counts for each filter and decade) and `totalDrivers`. |
| `GET /api/people/:driverId` | One driver's profile: story, statistics, highlights, season-by-season timeline, legacy and rivalry (curated drivers), related drivers, sources and definitions. |
| `GET /api/prediction/next-race` | The next Grand Prix, its prediction (when qualifying exists) and the accuracy history. |
| `GET /api/prediction/:season/:round` | Prediction for any race from 2015 on, rebuilt using only earlier races, and compared with the actual result when it has been run. |

## How the data is handled

- **Curated content** (`server/data/history.json`, `people.json`) holds the editorial writing, image credits, and the champion and career statistics. Statistics were fetched from Jolpica and written into these files by script, not typed by hand, so History and People keep working when Jolpica is down. See "The Grid" below for how the driver archive is built.
- **`jolpicaService.js`** is the only code that calls Jolpica. It uses one serial queue (about three requests a second), retries on 429/5xx honouring `Retry-After`, and caches in memory and on disk (the OS temp directory, `paddock-cache`). If Jolpica fails and an older cached copy exists, the older copy is served.
- **The browser never calls Jolpica.** The frontend talks only to `client/src/services/api.js`.
- **Degraded states:** with Jolpica unreachable, History shows curated champions with a notice, The Grid serves the baked archive (through 2025) with a notice that live current-season data is unavailable, and Prediction returns a clear error. Nothing is made up to fill the gap.

## The prediction model

The Python model is embedded as a string in `server/services/predictionService.js` and run with `python3 -I -c`. This keeps the project inside the required folder structure: Node sends one JSON document on stdin and reads one JSON result from stdout. There is no extra process, port or folder.

**Rules the model follows**

- No qualifying result, no prediction. The page says so and shows the model's past record instead.
- If Python or its libraries are missing, the API returns `status: "model-unavailable"` and the page says so. It never shows placeholder numbers.
- Every prediction uses only races that happened before the target race.

**Features** (all computed from earlier races): qualifying position; the historical win rate of that grid slot; the driver's average finish over five races; their points share and wins over ten races; the constructor's points share (five races) and wins (ten); the driver's win record and average finish at this circuit.

**Method**

1. **Baselines:** pick the pole-sitter, and rate drivers by grid-slot history alone.
2. **Model:** logistic regression on standardised features.
3. **Chronological split:** training uses races up to the 40 before the target; those 40 are held out and used only to calibrate (Platt scaling). The earliest 20 races only build history.
4. **Normalisation:** each race's probabilities are scaled to sum to 100% across the whole field.
5. **Backtest:** walk-forward. For every race from 2022 on, the model is re-fitted using only earlier races and scored on that race.

**Latest backtest** (112 races, 2022 to round 20 of 2026, as of 16 Nov 2026):

| | Winner picked | Log loss | Brier |
| --- | --- | --- | --- |
| Equal chance for all | n/a | 3.012 | 0.951 |
| Grid-slot history only | n/a | 1.351 | 0.601 |
| Pick the pole-sitter | 59.8% | n/a | n/a |
| **PADDOCK model (calibrated)** | **62.5%** | **1.121** | **0.540** |

The model also puts the winner in its top three 90% of the time. It is a modest improvement on picking pole, not a crystal ball: race results depend heavily on strategy, weather and incidents. These numbers change as new races are added, so the live page is the source of truth.

**Known limitations:** constructor history resets when a team is renamed; the model cannot see weather, penalties, tyre strategy or reliability; sprint results and the 2026 regulation change are not modelled specifically (recent-form features adapt as 2026 races accumulate).

## The Grid: driver archive and profiles

**Coverage.** The archive holds every driver who has started a World Championship Grand Prix: 790 drivers baked from Jolpica results for 1950 to 2025, plus anyone new in the current season, merged live by the server (793 at the time of writing). It is not limited to famous names. A driver who only entered or failed to qualify is not included.

**How it is built.** Every season's race results were crawled from Jolpica once and aggregated into per-driver career records (team, starts, wins, podiums, poles and points for every season, plus the debut, first win and last start). The aggregation lives in one function, `aggregateRaces` in `jolpicaService.js`. The same function produces the baked data in `people.json` and the live merge of seasons after `meta.bakedThrough`, so figures are calculated consistently. Titles come from the final standings of each season (the same table the History pages use), so championships are never confused with race wins.

**Definitions** (also shown at the foot of every profile):
- **Start.** A driver started a Grand Prix unless Jolpica marks them Did not start, Did not qualify or Did not prequalify, or as withdrawn (`positionText` W) with no laps completed. A driver counts once per race, even when a 1950s shared drive produced two result rows (this is what makes Fangio's total 51, not 58).
- **Pole position.** A race started from grid position 1, as recorded by Jolpica.
- **Current driver.** Someone who started at least one Grand Prix in the latest season, so one-off substitutes count while they are on the latest calendar.
- **Accuracy.** Totals match official career records for the great majority of drivers (for example Senna 161 starts, 41 wins, 80 podiums, 65 poles; Fangio 51, 24, 35, 29). A few differ by one or two where sources disagree about incidents before the start: Schumacher 307 starts (official 306) and 67 poles (official 68), Prost 198 starts (199), Lauda 172 (171), Raikkonen 351 (349), Moss 17 poles (16).

**Stories.** Thirty drivers have curated magazine features in `people.json` (the "drivers" array): a tagline, a story of 45 to 65 words, 3 to 5 highlights, a legacy of 30 to 40 words, an optional rivalry, and (where documented) the road to Formula 1. The build step that wrote them checks the lengths, and cross-checks every debut, first win, title count and specific claim (for example "nine wins from sixteen races in 1992") against the Jolpica data. The curated drivers are the five original Legends and nine champions and contenders from before, plus Norris, Piastri, Leclerc, Russell, Antonelli, Sainz, Mansell, Piquet, Hunt, Emerson Fittipaldi, Ascari, Rosberg, Brabham, Graham Hill, Button and Damon Hill. Every other driver gets a short summary generated only from verified statistics (debut, results, teams) and is flagged on the page as not yet written up. No career detail is invented, and no verified karting or junior information is shown for drivers PADDOCK has not researched.

**Page structure.** Archive: filters (All drivers, Current drivers, World Champions, Retired drivers), a decade filter, name search, and 24-card pages with "Show more". Profile: A. introduction (photograph, name, nationality, career years, number, status, tagline), B. the story, C. career statistics (World Championships shown separately from wins), D. career highlights, E. season-by-season timeline by team with champion seasons marked, F. legacy and rivalry, then the road to F1, related History stories, other drivers to explore, and sources. Filter, decade and search state live in the URL (`/people?filter=champions&decade=1980s&q=...`), so views can be shared.

### Driver photography

Every photograph is a portrait of the driver (face visible, in a race suit or paddock setting). No car, circuit or generic racing image is used for a driver. All paths go through one mapping: the `portraits` object in `server/data/people.json` (keyed by Jolpica driver id), read by `peopleController.js` and rendered by the single `imageSrc()` helper in `People.jsx`. To add or replace a photograph, put the file in `client/public/images/` and edit that one entry; no component changes are needed.

| Item | Convention |
| --- | --- |
| Filename | `portrait-<jolpica driverId>.jpg`, lowercase with underscores or hyphens exactly as in Jolpica (for example `portrait-norris.jpg`, `portrait-emerson_fittipaldi.jpg`). |
| Format | JPEG (sRGB), progressive, quality about 74. |
| Size | Longest side 1200 px, under about 200 KB. Portrait orientation (about 4:5) is ideal; the archive cards and the profile hero both use a 4:5 frame, so keep the face in the upper half. Landscape sources work with a focal point. |
| Focal point | `focus` (CSS `object-position`, default `50% 28%`) positions the crop, for example `57% 38%` for a wide shot with the face right of centre. |
| Entry fields | `file`, `alt`, `caption`, `focus` and `credit` (`author`, `license`, `licenseUrl`, `source` from the Wikimedia Commons file page). The credit is shown as one small line under the portrait. |

Photographs were taken from each driver's Wikidata image (their own Commons portrait) and checked by eye, with a few replaced by sharper portraits where the first was too small or turned away. They exist for 46 drivers: all 30 curated drivers and the current grid (Albon, Gasly, Ocon, Hulkenberg, Bearman, Hadjar, Lawson, Stroll, Bortoleto, Colapinto, Lindblad, Perez, Bottas, Tsunoda, Camara, Hirakawa). Licences are CC BY, CC BY-SA, CC0, public domain, and the UK Open Government Licence (Hamilton). Ascari's image is an archival *El Grafico* magazine cover (public domain), the best licensed image found. **Missing assets:** the other 747 drivers have no photograph yet and show a designed placeholder (outlined initials and "Photograph not yet available"); the profile still shows all of their information. No image is reused across drivers. Older car and action photographs from the first version (`senna.jpg`, `norris.jpg` and similar) remain in `client/public/images/` because Home and History still use some of them, but no driver page uses them.

## Content, images and sources

- Photographs are from **Wikimedia Commons** under CC BY / CC BY-SA licences. Each caption shows author, licence and a link to the file page. Files live in `client/public/images/`.
- Championship and career statistics: **Jolpica F1 API**.
- Editorial summaries are written by PADDOCK, and each decade links to its season pages. Driver features cite the Jolpica data for every figure. Karting and junior-career entries appear only where they are well documented; where PADDOCK has none, the profile says so instead of guessing.
- PADDOCK is independent and is not affiliated with Formula 1, the FIA or any team.

## Design

The interface follows an editorial dark/ivory system adapted from the Arqos Studio reference: black and warm-ivory (`#F1EDE9`) sections, Switzer type (loaded from Fontshare), a racing-flare accent (`#FF4A1C`), "+ Label" section heads with orange count pills, dashed hairline rows, a sticky scroll-driven introduction, and a giant footer wordmark. There is no 3D. Pages read only from the PADDOCK API; nothing in the UI is hard-coded except editorial copy and photo credits.

## Project structure

The tree is exactly as specified. Notes on where a few shared pieces live:

- **Global styles** (colours, type, navbar, menu, footer, cards, chips, loading and error states) are the first half of `client/src/css/Home.css`, imported once by `App.jsx`. The other CSS files are page-specific.
- **Shared UI pieces** (`Plus`, `Reveal`, `SectionHead`, `RevealText`, `Faq`, `Credit`, `Status`) are exported from `client/src/components/Footer.jsx`, because no extra component files are allowed.
- **Decade pages and driver profiles** are views inside `History.jsx` (`/history/:decade`) and `People.jsx` (`/people/:driverId`), so no extra page files exist.
- **Term of the day** (Home page, above the stacked sections) reads the glossary in `client/src/data/knowMoreInfo.js`, a verbatim copy of the 76-term `knowMoreInfo` module from the All_about_F1 project. The term is chosen by date alone (the UTC day number stepped through the list by a stride coprime with its length), so every visitor sees the same term on a given day and all 76 appear before any repeats. No backend or randomness is involved. To add or fix a term, edit that file; the feature picks it up automatically. Entries without a `funFact` show their real F1 `example` instead, and entries whose `shortDescription` was cut off with an ellipsis show the first full sentence of their `meaning`.
- **The Stories** (`/history`, nav label "Stories") is an editorial archive of the 30 stories in `client/src/data/f1Stories.js` (moved from `public/`, because Vite can only import modules from `src/`). The list page and the article page (`/history/<slug>`) are both views inside `History.jsx`. Filters use the file's real categories (`STORY_CATEGORIES`). Photographs are mapped to stories in the `STORY_PHOTOS` table at the top of `History.jsx`, using only existing licensed images that genuinely relate to a story (credits come from the Wikimedia records). 22 of the 30 stories have a photograph; the other 8 get a typographic cover until suitable licensed images are added there. The old decade archive and its `history.json` data are no longer shown, but the `/api/history` routes are untouched.
- **Driver profile extras** (`People.jsx`): the *Career journey* (one large panel per team stint, grouped from the driver's own seasons) and the *Career timeline* (one horizontal strip of milestone cards) are generic components fed by data. A driver's `timeline` in `client/src/data/driverDossiers.js` overrides the generated milestones (Max Verstappen has one); otherwise `driverTimeline.js` builds them from the driver's record. Team photographs and colours live in `client/src/data/teamArchive.js`: a photo is used only when its car belongs to the stint's seasons, otherwise a designed panel is shown. No team logos are included because no consistent licensed set exists; add `logo: 'file.svg'` to a team's entry to show one. The social-icon strip shows only links in `driverSocials.js`; entries that failed a link check on 19 Nov 2026 were removed and are listed in a comment there.
- `client/index.html` is required by Vite and is the only file outside the specified tree besides the npm lockfiles.
- The site uses Framer Motion for animation. GSAP and Three.js are not used.

## Adding content

- **A new decade or era:** add an object to `decades` in `server/data/history.json`. The History page picks it up automatically.
- **A new driver feature:** add an object to the `drivers` array in `server/data/people.json` (copy an existing one, keeping the story to 45 to 65 words, the legacy to 30 to 40 words and 3 to 5 highlights). Every driver who has started a Grand Prix already has a generated profile; a curated entry replaces it.
- **A new driver photograph:** see "Driver photography" above.
- **A new season:** nothing to do while the season is in progress (the server merges live results). When the season ends, re-bake `archive` in `people.json` through the new year and raise `meta.bakedThrough`.
- **New champions:** update the `seasons` map in `history.json` when a season ends. Seasons newer than the file are listed live as in progress.
