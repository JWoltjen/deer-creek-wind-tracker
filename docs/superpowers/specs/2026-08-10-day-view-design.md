# Day View — single calendar day, fixed axis, browsable — Design

**Date:** 2026-08-10
**Author:** Jeff Woltjen (with Claude)
**Status:** Approved design, proceeding to plan (inline build).
**Builds on:** the `chart-polish` branch (hour/five axes, in-window chip).

## 1. Problem

The "Day" tab slices a **rolling last-24-hours** window, then filters to riding hours. So before today's session it shows *yesterday's* 11am–7pm, and mid-afternoon it **blends two riding days** on one axis with no divider. "Day" doesn't mean "a day."

## 2. Goal / Approach (agreed)

"Day" = **one calendar day**, defaulting to **today**, on a **fixed 11am–7pm time axis** that fills left-to-right up to *now* (so a morning look is mostly empty and fills through the day). A **‹ prev / next ›** stepper browses back to the earliest data day and forward to today. Week/Month are unchanged; **Week stays the default tab** so nobody lands on an empty chart.

## 3. Design

### 3.1 Day = a selected calendar day
- New `selectedDay` state in HistoryChart (a `YYYY-MM-DD` string), **default today** (`localDateStr(nowMs)`), **not persisted** (resets to today each visit).
- Day data = `sliceByDay(observations, selectedDay)` then the existing `ridingHoursFilter(_, hours)`. (Riding/Full still applies: Riding → 11–7 window; Full → full 24h — see 3.3.)
- The "time in your range" stat is computed over the selected day's riding readings (so it's a real single-day total).

### 3.2 Day stepper
- Shown only when `range === "day"`, above the chart: **`‹  Aug 9  ›`** (label `formatDayLabel(selectedDay)` e.g. "Aug 9").
- `‹` = `selectedDay = addDays(selectedDay, -1)`; `›` = `addDays(+1)`.
- Bounds from the data: `first = dataDayRange(observations).first` (earliest reading's `localDate`), `last = localDateStr(nowMs)` (today). `‹` disabled when `selectedDay <= first`; `›` disabled when `selectedDay >= last`. Steps by **calendar day** (a data-less day in range renders an empty grid — predictable).
- If there are no observations, `first = today`, so both arrows are disabled and Day shows today's empty grid.

### 3.3 Fixed-time axis (the "empty and filling" behavior)
- The Day view renders on a **fixed time x-axis** with a domain set by the selected day + hours mode:
  - Riding: `[selectedDay 11:00, selectedDay 19:00]` (`ridingStartHour`/`ridingEndHour`).
  - Full: `[selectedDay 00:00, next-day 00:00]`.
- Data points are plotted at their actual time (`x = Date.parse(time)`), so the area to the right of "now" (or of the last reading) is **naturally empty**; the grid, good-zone band, and **hourly ticks** span the full domain regardless of how much data exists. Empty day → the grid still renders (no "No history yet").
- Implemented as a **fixed-time-window mode of `BandChart`**: a new optional prop `dayWindow?: { startMs: number; endMs: number }`. When set, BandChart uses `dataKey="x"` (time), `domain={[startMs, endMs]}`, hourly ticks across the window (`hourTicksTime`), **no day-boundary ReferenceLines**, and it renders even with zero points. When absent, BandChart keeps its current packed-index behavior (used by Week). The band Area/Lines, good-zone `ReferenceArea`, tooltip, and in-window dim are **reused unchanged** (they key off y-values / the point payload). The prime stripe is **omitted in day mode** (the real hour axis makes it unnecessary; keeps the mode simple).

### 3.4 Week / Month unchanged
Week keeps its packed multi-day index axis (marker-hour ticks + day labels). Month keeps its per-day bars. Default `range` stays `"week"`.

## 4. Components / Files
- `web/src/chartData.ts` — add pure helpers: `localDateStr(ms)`, `addDays(dateStr, n)`, `dataDayRange(obs) → { first, last }`, `sliceByDay(obs, dateStr)`, `hourTicksTime(startMs, endMs) → AxisTick[]` (label via `formatHourShort`; `i` field carries the ms tick value). `formatDayLabel(dateStr) → "Aug 9"` may live in `format.ts`.
- `web/src/components/chart/BandChart.tsx` — add the `dayWindow?` fixed-time mode (x = time, fixed domain, hourly ticks, no boundaries, render-when-empty); reuse everything else.
- `web/src/components/chart/HistoryChart.tsx` — `selectedDay` state; the stepper UI (bounds from `dataDayRange`); for Day, slice via `sliceByDay`, compute the `dayWindow` (riding vs full) and pass it + `inWindow` to BandChart; the in-window stat uses the selected day.
- `web/src/theme.css` — stepper styles.

## 5. Testing
- Pure helpers TDD: `localDateStr`, `addDays` (incl. month rollover), `dataDayRange`, `sliceByDay` (keeps only the given `localDate`), `hourTicksTime` (a tick per hour with correct labels), `formatDayLabel`.
- `HistoryChart`: Day view shows the stepper; `‹`/`›` change the shown day and are disabled at the bounds; switching to Day defaults to today; the stat reflects the selected day. Week/Month unchanged (existing tests stay green).
- `BandChart`: with `dayWindow` renders the `.band-chart` container even with zero points (empty grid); without it, unchanged.
- Full web suite + build green; visual dev-run before merge (empty-and-filling today, stepping back to yesterday, fixed hour axis).

## 6. Out of Scope
- Week/Month date navigation (only Day is browsable).
- Persisting the selected day across visits (always opens on today).
- The overnight sensor gap (data reality).

## 7. Open Assumptions (flag if wrong)
- Viewer's timezone ≈ Mountain (holds — local user), so `localDateStr(now)` matches the data's baked-in Mountain dates.
- Stepper moves by calendar day (empty days allowed), bounded `[first data day, today]`.
- Prime stripe omitted on the Day fixed-axis view.
