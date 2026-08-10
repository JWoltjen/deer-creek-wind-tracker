# Chart Polish + "Time in Window" — Design

**Date:** 2026-08-10
**Author:** Jeff Woltjen (with Claude)
**Status:** Approved design (via visual companion), pending spec review
**Builds on:** the shipped app (MVP → redesign → polish → calibration).

## 1. Problem / Goal

Five refinements after using the live site:
1. **Week x-axis has no time labels** (Day does). Need time on Week's axis.
2. **Hours aren't granular** — Day should tick every hour; the ticks currently thin out.
3. **Y-axis increments by 6** (Recharts auto) — should read in fives.
4. **No "how much was actually rideable" summary** — the good-zone band is shaded, but there's no way to look back and say "only ~2h 40m was within my window today." Add a toggleable chip + on-chart emphasis + a time stat.
5. **Mobile can't add a kite** — the kite input only reacts to a physical Enter keydown, which mobile "Done" doesn't reliably fire.

Non-goal confirmed: the overnight gap (Full view stops ~10pm, resumes ~5am) is the **sensor not reporting at night** — no data to plot, nothing to fix.

## 2. Design

### 2.1 X-axis time labels (#1, #2)
`BandChart` currently hides the x-axis on Week (`hide={showDayLabels}`) and thins Day ticks via `minTickGap`.
- **Day view:** show a tick at **every hour** (12-hour labels via `formatHourShort`, e.g. `11a 12p 1p … 7p`). Achieved by generating explicit hour tick positions (the first point-index at each new clock hour) rather than relying on `minTickGap`.
- **Week view:** show the x-axis with **per-day date labels** (kept, at day boundaries) **plus a light hour tick a few times per day** (default: noon and 3p — configurable set of "marker hours"). Not every hour (would overlap across 7 packed days).
- **Month view:** unchanged (date axis on `MonthBars`).
- The tick positions are computed from the plotted `BandPoint[]` (which carry each reading's `time`), so they work with the skip-night ordinal index axis. A small pure helper `hourTicks(points, mode, markerHours?)` returns the `i` indices to tick and their labels; unit-tested.

### 2.2 Y-axis in fives (#3)
Replace the auto ticks. Compute an explicit tick array at multiples of 5 from 0 up to the next multiple of 5 ≥ `dataMax` (e.g. data max 27 → ticks `[0,5,10,15,20,25,30]`), and pass `ticks={...}` to `<YAxis>` (drop the `domain: [0, "dataMax + 4"]` auto-domain in favor of `[0, roundedMax]`). A pure helper `fiveTicks(maxMph)` returns the array; unit-tested. Applies to `BandChart` and `MonthBars`.

### 2.3 "Time in window" (#4)
A new **"in-window" chip** in the History header (alongside Day/Week/Month + Riding/Full), **off by default** (non-obtrusive). The chip label always shows the stat, e.g. **"◑ in-window · 2h 40m"**. Toggling it **on**:
- **Stat:** a line above the chart — **"2h 40m in your range"** (for the current range: Day = that day, Week = the week). Computed by `timeInWindow(observations, thresholds, ridingWindow, nowRangeSlice)`: over the visible **riding-hour** readings, sum each in-window reading's coverage = `min(gap-to-next-reading, CAP=5min)`; "in window" = reading mid `(low+high)/2` within `[goodLowMph, goodHighMph]`. Formatted `Hh Mm` / `Mm`. Pure + unit-tested (incl. gap capping).
- **Emphasis (treatment A — dim out-of-window):** in `BandChart`, the gust/lull lines are split into in-window (accent `#22d3ee` / `#0e7490`) and out-of-window (muted `#334155`) segments. Implemented by deriving two sets of series values per point where the non-matching set is `null` (Recharts draws gaps with `connectNulls={false}`): `highIn/highOut`, `lowIn/lowOut`, keyed off whether the point's mid is in-band. Chip **off** → the current single-color lines (no split). The faint range Area and good-zone band are unchanged in both states.
- **Month view:** the chip shows the stat only (total time over the month); no band-dimming (bars already convey category).
- The chip state persists via `usePersistedState("dc.chart.inWindow", false)` (consistent with the other chart toggles). Uses `useThresholds()` so "your range" = the calibrated band (or generic if uncalibrated).

### 2.4 Mobile kite entry (#5)
Wrap the kite input in a `<form onSubmit={e => { e.preventDefault(); addKite(); }}>` so Enter / Go / Done all submit on any device, **and** add a visible **"＋" add button** next to the input (calls `addKite`). Keep the existing add/dedup/clear logic. This removes the reliance on the `onKeyDown` Enter handler.

## 3. Components / Files (impact map)
- `web/src/chartData.ts` — add `hourTicks(points, mode, markerHours?)`, `fiveTicks(maxMph)`; extend `BandPoint` shaping (or a derived helper) with in/out split fields when needed. Add `timeInWindow(...)`.
- `web/src/config.ts` — add `weekMarkerHours: [12, 15]` (Week hour-tick hours).
- `web/src/components/chart/BandChart.tsx` — x-axis (Day vs Week ticks derived from the existing `showDayLabels` prop: `false`→Day=every-hour, `true`→Week=marker-hours + day labels), y-axis (five ticks), in/out split lines when the new `inWindow: boolean` prop is on. Only one new prop (`inWindow`).
- `web/src/components/chart/MonthBars.tsx` — five-tick y-axis.
- `web/src/components/chart/HistoryChart.tsx` — the in-window chip (persisted), the stat line, pass `inWindow` + range context down; compute `timeInWindow` from the sliced data.
- `web/src/components/CalibrationPanel.tsx` — `<form>` wrapper + "＋" button for kites.
- `web/src/theme.css` — chip, stat, add-button styles.

## 4. Testing
- Pure helpers TDD: `fiveTicks` (0→[0,5], 27→[0..30]); `hourTicks` (Day = every hour index; Week = markerHours per day + boundaries); `timeInWindow` (in-band summed, out-band excluded, gap capped at 5 min, riding-hours only).
- `BandChart`: renders hour ticks (Day) / marker + day labels (Week); y-axis ticks in fives; with `inWindow` a split (in/out) line set renders (assert the container / that both series exist), off → single set. (jsdom = structure/props, not pixels.)
- `HistoryChart`: the in-window chip toggles (persisted key), the stat line appears with a value; Month shows stat without band split.
- `CalibrationPanel`: submitting the kite form (fireEvent.submit) adds the kite; the "＋" button adds it; existing tests stay green.
- Full web suite + build green; visual dev-run before merge (hour ticks, fives, dim-emphasis, mobile form).

## 5. Out of Scope
- Changing the collector, data model, or the overnight sensor gap.
- Per-day in-window breakdown on Week (single total for the range is enough now).
- kg/knots unit toggles.

## 6. Open Assumptions (flag if wrong)
- Week marker hours = noon + 3p (config `weekMarkerHours`).
- "In window" = reading mid within `[goodLowMph, goodHighMph]`; time = summed capped-gap (cap 5 min) over riding-hour readings.
- In-window chip off by default, persisted; dim-out-of-window emphasis (treatment A); Month = stat only.
- Kite add via form-submit + "＋" button.
