# Deer Creek Kite-Wind Tracker — Design

**Date:** 2026-08-08
**Author:** Jeff Woltjen (with Claude)
**Status:** Approved design, pending spec review

## 1. Problem & Goal

I'm a beginner kitesurfer in Sandy, UT, an hour's drive from Barbed Wire Beach
at Deer Creek Reservoir. Deciding whether to make that drive is hard:

- The live wind readout for the beach exists but shows **only the last 10 rows**
  (~20 minutes of history), so I can't see patterns.
- The NWS forecast I rely on is unreliable — it recently said the wind would top
  out at 10 mph, so I stayed home, and it turned out to be a good day.

**Goal:** A free website that (a) continuously collects the beach's wind readings
so I can see a real multi-day history, and (b) logs the forecasts alongside the
actual wind so I learn *how much to trust the forecast* for this specific spot —
and which forecast model is least wrong here.

### Rider context (drives the "good wind" thresholds)
- Weight ~220 lbs → needs more wind than a light rider to get planing.
- Kites: 15 m² (light-wind) and 12 m² (stronger-wind).
- Skill: learning to waterstart → **steady/consistent wind matters as much as speed.**

### Success criteria
- I can open one URL on my phone and immediately see: is it good right now?
- After ~1–2 weeks I can see the daily pattern ("wind usually fills in around 1 PM").
- I can see, per day, what the forecast predicted vs. what actually happened, and a
  running scoreboard of which model is most accurate for Deer Creek.

## 2. Data Sources (all free, no API key — verified 2026-08-08)

| Source | Role | Endpoint | Cadence |
|---|---|---|---|
| Utah Wind Aggregator (Barbed Wire Beach) | **Primary observations** | `http://65.130.252.76:90/fastDC.htm` (parse first/top table) | ~2 min at source |
| Open-Meteo (multi-model) | Forecast | `https://api.open-meteo.com/v1/forecast?latitude=40.4471&longitude=-111.4776&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=mph&models=gfs_hrrr,ecmwf_ifs025,gfs_seamless` | hourly |
| NWS | Forecast (the one I currently use) | `https://api.weather.gov/gridpoints/SLC/113,159/forecast/hourly` (requires `User-Agent` header) | hourly |

- Open-Meteo model ids: `gfs_hrrr` = HRRR (high-res US short-range), `ecmwf_ifs025`
  = ECMWF, `gfs_seamless` = GFS. Response returns per-model fields, e.g.
  `wind_speed_10m_gfs_hrrr`.
- NWS grid `SLC 113,159` was resolved from the point `40.4471,-111.4776`.

**Not in v1 (deliberately):**
- The other 6 stations already on the aggregator page (Deer Creek Dam Top/Base,
  Provo Canyon, North Jordanelle, Heber Airport, etc.). Trivial to add later since
  we already fetch that page — the parser will leave a clean hook. Dam Top is the
  most promising future add (it often shows wind building before it reaches the beach).
- Proprietary sources (iKitesurf/WeatherFlow, Windy) — paid keys, unnecessary since
  the free obs already cover this basin.

## 3. Architecture

Everything runs in the cloud for free. No always-on PC required.

```
GitHub Actions (scheduled)                    GitHub Pages (static site)
┌───────────────────────────────┐             ┌──────────────────────────────┐
│ collect.yml  (every 5 min)    │   commits   │ React + Vite dashboard        │
│  - always: ObservationsCollect│   data/*    │  fetches data/*.ndjson at     │
│  - top of hour: ForecastCollect│  ────────▶ │  runtime (from raw GitHub),   │
│                               │             │  computes ALL analytics in    │
│ C# / .NET console collectors  │             │  the browser:                 │
│  HttpClient → parse → append  │             │   verdict, 7-day chart,       │
│                               │             │   time-of-day pattern,        │
│                               │             │   forecast-vs-actual, model   │
│                               │             │   scoreboard                  │
└───────────────────────────────┘             └──────────────────────────────┘
```

**Core design principle — dumb collectors, smart page.** Collectors only capture
and append *raw* data. Every piece of interpretation (good/gusty classification,
forecast-vs-actual, model scoring) lives in the React app and is driven by a single
config file. This means thresholds can be retuned anytime with zero risk to the
historical data, and the collected data stays a clean, source-of-truth record.

## 4. Repository Layout

```
deer-creek-wind-tracker/
├─ collectors/                 # C# / .NET
│  ├─ Collectors.sln
│  ├─ Collectors.csproj
│  ├─ ObservationsCollector.cs # fetch fastDC.htm, parse beach table, append
│  ├─ ForecastCollector.cs     # fetch Open-Meteo + NWS, append snapshot
│  └─ Program.cs               # arg: "observations" | "forecasts"
├─ web/                        # React + Vite dashboard
│  ├─ src/
│  │  ├─ config.ts             # thresholds + location (the ONE place to tune)
│  │  ├─ classify.ts           # good/gusty/light/strong logic
│  │  ├─ analytics.ts          # forecast-vs-actual, model scoreboard, hourly pattern
│  │  └─ components/           # Verdict, HistoryChart, HourPattern, ForecastVsActual, ModelScoreboard, DataTable
│  └─ vite.config.ts
├─ data/                       # append-only, committed by Actions
│  ├─ observations.ndjson
│  └─ forecasts.ndjson
├─ .github/workflows/
│  ├─ collect.yml              # every 5 min: obs always, forecasts at top of hour
│  └─ deploy-web.yml           # rebuild site only when web/ changes
└─ docs/superpowers/specs/     # this document
```

## 5. Data Model (append-only NDJSON — one JSON object per line)

NDJSON is chosen because it appends cleanly, diffs well in git, and never rewrites
history. Volume is tiny (a week of 5-min obs ≈ ~2,000 lines).

**`observations.ndjson`** — one row per unique beach reading:
```json
{"time":"2026-08-08T14:44:00-06:00","tempF":95,"dir":"SW","low":15,"high":20}
```

**`forecasts.ndjson`** — one row per source/model per forecast hour, tagged with when it was fetched:
```json
{"fetchedAt":"2026-08-08T15:00:00-06:00","source":"open-meteo","model":"hrrr","validTime":"2026-08-08T18:00:00-06:00","windMph":14,"gustMph":22,"dirDeg":225}
```
- `source`/`model`: `open-meteo`/`hrrr`, `open-meteo`/`ecmwf`, `open-meteo`/`gfs`, `nws`/`nws`.

## 6. Collector Behavior

### Observations (every 5 min)
1. GET `fastDC.htm`. Parse the **first** `<table>` (header "Barbed Wire Beach").
2. Each data row → `MM/DD  hh:mm AM/PM`, temp, direction, `low-high` (or single value → low==high).
3. **Timestamp normalization:** source times are Mountain Time with no year.
   Attach `America/Denver` (via `TimeZoneInfo`, correct for MST/MDT) and the current
   year, handling the Dec→Jan rollover (if parsed month is ahead of "now", use prior year).
4. **Dedup:** append only rows whose `time` is newer than the newest already stored.
5. If the fetch fails or parses to 0 rows, **do nothing** (never overwrite good data).

### Forecasts (top of the hour)
1. GET Open-Meteo (3 models in one call) and NWS hourly (with `User-Agent`).
2. Flatten to per-hour rows, stamp `fetchedAt`, append.
3. Each source is independent: if one is down, log and continue with the other
   (a bad forecast source must never block the observations run).

### Cadence & race-avoidance
- A **single** `collect.yml` on `*/5` cron avoids two workflows racing to push.
  It always runs observations, and additionally runs forecasts when the run lands
  at the top of an hour.
- GitHub Actions cron can drift/delay a few minutes — acceptable, because the source
  keeps ~20 min of history so a 5-min poll always overlaps and never misses a row.

## 7. "Good Wind" Classification (config-driven, computed in browser)

Config defaults (in `web/src/config.ts`, all tunable):
```
goodLowMph = 15      # below this = too light for a 220 lb rider to plane
goodHighMph = 26     # above this = strong for someone still learning
steadySpreadMax = 5  # (high-low) <= 5 → steady
gustySpreadMax = 10  # (high-low) 6..10 → rideable but gusty; >10 → too gusty
idealDirs = ["SW","SSW","WSW"]   # classic "up the lake" working wind
okDirs = ["S","W"]
```

Per reading, let `lo`,`hi` = low/high mph, `spread = hi - lo`, `mid = (lo+hi)/2`:

| Category | Rule | Color |
|---|---|---|
| ⚪ Too light | `hi < goodLowMph` | gray |
| 🔴 Strong / caution | `mid > goodHighMph` **or** `spread > gustySpreadMax` | red |
| 🟢 Good for you | in band **and** `spread <= steadySpreadMax` | green |
| 🟡 Rideable but gusty | in band **and** `spread` 6–10 | yellow |

Direction shown as a separate badge: 🟢 ideal (SW/SSW/WSW), 🟡 ok (S/W), ⚪ off-direction.

## 8. Website Sections

1. **Good Right Now** — big verdict from the latest reading (category + direction
   badge + "updated N min ago"). The at-a-glance "should I drive?" answer.
2. **Last 7 Days** — wind chart over time with the good band shaded and points
   colored by category.
3. **When Is It Usually Good?** — readings bucketed by hour-of-day to reveal the
   daily thermal pattern (the predictive payoff for timing the drive from Sandy).
4. **Forecast vs Actual** — per day: each source's predicted daytime peak vs. the
   actual observed peak, with the miss highlighted.
5. **Model Scoreboard** — running mean absolute error per model/source, so I know
   whose number to trust.
6. **Full Data Table** — collapsible, filterable, CSV download.

### Forecast-vs-actual & scoreboard methodology (documented, computed in-browser)
- Daytime window: 09:00–20:00 Mountain.
- **Actual daily peak** = max reading `mid` within the window.
- **Forecast daily peak** = max `windMph` within the window, taken from the last
  forecast snapshot fetched *before* that day began (i.e., what I'd have seen when
  deciding whether to go).
- **Error** = forecastPeak − actualPeak (per day). **Scoreboard** = mean of |error|
  per source over all evaluated days.

## 9. Deployment

- **Site build:** `deploy-web.yml` runs only when `web/**` changes, builds Vite,
  publishes to GitHub Pages. It does **not** rebuild on every data commit.
- **Data access:** the deployed site fetches the NDJSON directly from
  `raw.githubusercontent.com/<user>/deer-creek-wind-tracker/main/data/*.ndjson`
  at runtime (raw sends `Access-Control-Allow-Origin: *`). This decouples data
  updates from site rebuilds — no redeploy storm from 5-min commits.
- **Repo:** public (free unlimited Actions minutes; data is non-sensitive).
- **Vite `base`** set to the repo path for Pages.

## 10. Out of Scope (v1) / Future
- Other aggregator stations (esp. Deer Creek Dam Top as a "wind building" early signal).
- Push/email alerts when it turns good.
- Longer-range archival/seasonal analysis.
- Personalized kite recommendation (15 m² vs 12 m²) per reading.

## 11. Open Assumptions (flag if wrong)
- Timestamps normalized to Mountain Time (America/Denver).
- Observations poll every 5 min; forecasts hourly.
- Analytics computed client-side (collectors stay dumb).
- Public GitHub repo is acceptable for this data.
