# Lindol

**"May lindol ba malapit sa akin?"** A free, public-good web tool that lists recent earthquakes near any Philippine city: magnitude (with type), depth, distance and compass direction from the city, and time in **PHT** (Asia/Manila, UTC+8). It also has a short **Duck, Cover and Hold** card and a clear link to **PHIVOLCS** for official bulletins and tsunami advisories. English and Tagalog.

**For:** households, schools, and newcomers to the Philippines.

Live: https://lindol-one.vercel.app

## Not an official source
**Lindol is not an official source and is not a warning system.** For official earthquake bulletins and tsunami advisories, follow [PHIVOLCS](https://www.phivolcs.dost.gov.ph/) ([earthquake information](https://earthquake.phivolcs.dost.gov.ph/), [tsunami advisories](https://tsunami.phivolcs.dost.gov.ph/)). Lindol links to PHIVOLCS and does not scrape or republish its data. In an emergency call **911**.

## Data and attribution
Earthquake data: **U.S. Geological Survey (USGS) Earthquake Hazards Program**, public domain, https://earthquake.usgs.gov/. The browser calls the [USGS FDSN Event web service](https://earthquake.usgs.gov/fdsnws/event/1/) directly (no key, no proxy, no server). Distance and direction are computed on your device (haversine). Your last city, controls and last successful result are kept in `localStorage` only. "Use my location" runs only after you tap it, the coordinates never leave your device and are not stored.

The explainer text (`src/data/explainers.json`) and safety steps (`src/data/safety.json`) each cite a source URL; the smoke test fails if one is missing.

## Limits
- The USGS catalogue is global. It can be incomplete for small quakes in the Philippines, and its magnitudes, depths and locations can differ from PHIVOLCS figures for the same event.
- Magnitude is the size of the quake, not the shaking you felt. Lindol shows no intensity estimates, felt reports, damage predictions or aftershock odds.
- USGS can take minutes or longer to publish an event. Data refreshes on demand and at most every 5 minutes while the tab is visible.
- A quiet week is reported as empty. If a longer period at the same radius has a quake, the page names the closest one and offers that period. The radius stays put. A larger radius is offered only when the longer period is empty too.
- Safety steps and explainers are in English only (quoted from the cited sources); the interface toggle translates the rest.

## Develop
```
npm ci
npm run dev       # local dev server
npm run lint      # eslint + tsc + vitest unit tests
npm run build     # outputs dist/
npm run smoke     # static asset/data checks + headless Chromium at 375x812 and 1280x800 (USGS mocked from tests/fixtures)
scripts/check-live.sh https://lindol-one.vercel.app   # verify a deployed URL
```
`npm run smoke` installs Chromium through Playwright if it is missing and fails (never skips) if the browser cannot run.

## Verified with Kane CLI

[Kane CLI](https://www.testmuai.com/docs/kane-cli-introduction) runs the plain-English flows in `kane/flows/` in real Chrome against a deployed URL. `npm run verify -- <url>` prints pass or fail and writes `docs/kane/agent-feedback.md`. A Cursor stop hook and a Claude Code Stop hook send that file back to the agent when a flow fails. The fast mocked check is still `npm run smoke`.

Sign in with `kane-cli login --oauth`, or set `LT_USERNAME` and `LT_ACCESS_KEY`. Details, the quiet-week bug Kane surfaced, and the demo script are in [docs/kane/README.md](docs/kane/README.md).

The link-preview assets in `public/og/` (`image.png`, `preview.mp4`) are rendered from fixture data by `npm run build && node scripts/make-og.mjs` (needs ffmpeg) and committed.

## Add a city
Edit `src/data/cities.json` and add an object with the same shape: `{"name": "Tacloban", "region": "Leyte", "lat": 11.2543, "lon": 124.9632}`. Names must be unique and lat/lon must fall within the Philippines (about lat 4.5 to 21.5, lon 116 to 127); the smoke test checks this. The list was copied from the sibling tool [Hangin](https://github.com/0xjitsu/hangin) (MIT, same author).

## Support
Donate: https://github.com/sponsors/0xjitsu <!-- TODO: placeholder until Berna picks an account; set DONATE_URL in src/main.ts to '' to hide -->

## License
MIT
