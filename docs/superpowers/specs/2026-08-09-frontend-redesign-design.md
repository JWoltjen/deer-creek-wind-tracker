# Frontend Redesign — Deer Creek Kite-Wind Tracker

**Date:** 2026-08-09
**Author:** Jeff Woltjen (with Claude)
**Status:** Approved design (via visual companion), pending spec review
**Precedes:** Phase II (per-user equipment/level/weight calibration) — this redesign sets it up but does not implement it.

## 1. Problem

The shipped MVP works but the frontend is rough:
1. **Unprofessional type** — running on default `font-family: system-ui`.
2. **Loud in the wrong places** — the verdict is a giant emoji `<h1>` ("🟢 GOOD RIGHT NOW") while the actual reading is tiny text beneath it. Hierarchy is inverted.
3. **Source data is hard to see** — the raw readings live in a collapsed table at the bottom.
4. **No gust/average differentiation** — every chart collapses each reading to `mid = (low+high)/2` and plots a single line, discarding the lull↔gust spread, which (per the rider) is the whole story of whether a session is manageable.
5. **Dead code** — `web/src/App.css` is ~180 lines of leftover Vite template CSS; only the last ~6 lines are real.

Data semantics confirmed by the rider: a reading like `15-20` is **lull → gust** (min–max over the interval). Low = lull (worst-case drop), high = gust (peak), **spread = gustiness**.

## 2. Goals / Success Criteria

- Looks intentional and professional; glanceable on a phone in sunlight before an hour drive.
- The verdict is **quiet**; the **data** is the loudest thing on screen.
- Lull and gust are **always kept distinct** — never averaged away in any visualization.
- The raw source readings are visible without hunting.
- History is explorable across time ranges, without night noise drowning the ~8 riding hours that matter.
- All layout/logic stays config-driven so Phase II can swap static config for a user profile.

## 3. Visual Direction — "Field" (dark)

Chosen over "Instrument" (light technical) and "Editorial" (serif) directions.

- **Theme:** dark, high-contrast, glanceable. Defined as CSS custom properties (a single palette module), not inline scattered values.
- **Palette (baseline, tunable):**
  - background `#0b1220`, panel `#0e1729`, panel border `#1e293b`, hairline `#16213a`
  - text `#e6edf6`, muted `#94a3b8`, faint `#64748b`, dim `#475569`
  - **accent / gust** `#22d3ee` (cyan), lull line `#0e7490` (dim cyan)
  - category: good `#22d3ee`, gusty `#f59e0b`, strong `#ef4444`, too-light `#334155`
  - good-zone shade: cyan at ~0.07 opacity; prime-core stripe: cyan at ~0.05
- **Typography:** **Space Grotesk** (self-hosted via `@fontsource` or a `<link>`), used for headings and the numeric readouts; system sans fallback. No emoji in headings.
- **Status treatment:** small pill/dot chip (e.g. `● GOOD`), never a full-width shouty header.

## 4. Core Data-Display Principle

Keep `low` (lull) and `high` (gust) distinct in every view. `mid`/`spread` may be computed for classification and summaries, but **no chart plots `mid` as the primary series**. Category coloring uses the existing `classify(low, high)`.

## 5. Components (redesign)

### 5.1 Verdict / "Right Now" hero
- Small status chip (`● GOOD` in category color) + "updated N min ago".
- Large **`lull – gust mph`** readout, gust emphasized in accent color; small "LULL → GUST" label.
- One line: `<b>SW</b> · steady (5 mph spread) · ideal direction` — direction, steadiness (from spread), and direction rating.
- Null state: quiet "No data yet".

### 5.2 History chart (the centerpiece)
Lull–gust **band**: gust line (accent) on top, lull line (dim) on the bottom, gap filled; the good zone (`goodLowMph`–`goodHighMph`) shaded behind. **Fat band = gusty, thin band = steady.**

Two independent controls in the chart header:

**A. Range chips: Day / Week / Month**
- **Day** — a single day's window as a detailed band.
- **Week** — 7 packed day-panels side by side (see hours mode), thin day dividers, date labels.
- **Month** — one **lull–gust bar per day** (vertical bar from the day's min lull to max gust, colored by that day's dominant category), so ~30 days stay readable. Not the intraday band.

**B. Hours mode toggle: Riding (default) / Full**
- **Riding** — plot only the riding window (`ridingStartHour`–`ridingEndHour`), skipping night the way a stock chart skips overnight, so days pack together and daytime detail is large. A faint stripe marks the **prime** core (`primeStartHour`–`primeEndHour`).
- **Full** — plot the full 24h continuous, for when the user wants the whole picture (prevents a "claustrophobic" feeling).
- For **Month**, the toggle controls whether each day's bar summarizes riding-hours only or the full day.

**Implementation note (Recharts):** the "skip night" behavior is achieved with an **ordinal/index-based x-axis** — feed Recharts only the samples to plot (riding-hours-filtered in Riding mode; all in Full mode) indexed sequentially, so omitted night hours simply don't consume axis width. Day boundaries are drawn with `ReferenceLine`s; the good zone and prime-core with `ReferenceArea`s. The band is two series (lull, gust) with the area between filled (stacked-area or an `Area` with a `[low, high]` range datum). Month view is a separate small bar/candle chart. Empty state: "No history yet".

### 5.3 Recent readings (new, always visible)
A compact, always-shown list of the last ~8 readings straight from the source: `time · dir · lull–gust · spread · category dot`. Replaces the buried collapsed table as the primary "see the raw data" surface. "Download full CSV" stays (full history export). The old always-collapsed full table is removed in favor of this + the chart's Month range.

### 5.4 When it's usually good (hour-of-day)
Restyle the existing bar chart to the Field theme; bars colored by category. Optionally restrict to riding hours for a tighter, more relevant view.

### 5.5 Forecast trust (scoreboard) + Forecast vs actual
Restyle to Field theme as compact tables/rows (model, avg error, best-flagged). Keep the existing analytics; only presentation changes. Miss highlighting keeps its accent.

### 5.6 Layout / section order
Phone-first single column: **Right now → 7-day band chart → Recent readings → When it's usually good → Forecast trust (+ vs actual) → CSV download.** Header shows "Barbed Wire Beach · Deer Creek".

## 6. Config additions (`web/src/config.ts`)
Add, all tunable (same philosophy as the wind thresholds; Phase II will source these from a user/profile):
- `ridingStartHour = 11`, `ridingEndHour = 19` — riding window (inclusive of the start hour, through the end hour). **These replace `dayStartHour`/`dayEndHour`; the forecast-vs-actual "daytime peak" analytics switch to the riding window** so "did the forecast nail it" is judged over the hours that matter.
- `primeStartHour = 12.5`, `primeEndHour = 17` — prime core, used only for the chart's faint stripe (fractional allowed for shading).
- A `theme` palette object (or CSS variables) holding the Field colors.

Existing `dayStartHour`/`dayEndHour` are renamed to the riding-window values; `analytics.ts` (`actualDailyPeak`, `forecastDailyPeak`, `inDay`) is updated to read them. Existing analytics tests are updated for the new window bounds.

## 7. Cleanup
- Delete the dead Vite template CSS from `App.css`; introduce a small theme layer (CSS variables + base element styling) and per-component styles (CSS modules or a single organized stylesheet — follow what's cleanest for the existing setup).
- Remove leftover template assets/imports if any remain.

## 8. Testing
- Pure logic stays TDD: any new helper (e.g. `ridingHoursFilter`, month-bar aggregation `dailyBars(observations)`, band datum shaping) gets unit tests. Reuse the existing `classify`/analytics tests; update the window-bound tests.
- Component tests: render each restyled component in empty and populated states; assert the band renders both lull and gust series, the range/hours toggles switch data, and Recent readings lists rows with category dots.
- Keep the full suite green (collectors untouched; web suite extended).

## 9. Out of Scope (this redesign)
- Phase II personalization (equipment/level/weight → recalibrated thresholds). This redesign only makes the config the single source of truth so Phase II is a clean swap.
- Light mode / theme switching (dark-only for now).
- Collector changes — data model is unchanged; redesign is presentation + config only.

## 10. Open Assumptions (flag if wrong)
- Space Grotesk as the typeface; cyan accent; dark-only.
- Riding window 11–19, prime 12:30–17, both configurable.
- Recent readings shows ~8 rows; full history via CSV + Month range.
- Recharts stays the charting lib (ordinal-axis approach for skip-night); if the packed-panel Week view proves awkward in Recharts, a small custom SVG chart is an acceptable fallback.
