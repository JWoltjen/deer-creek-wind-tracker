# UI Polish & Data Freshness — Deer Creek Kite-Wind Tracker

**Date:** 2026-08-09
**Author:** Jeff Woltjen (with Claude)
**Status:** Approved design (via visual companion), pending spec review
**Builds on:** the Field redesign (`2026-08-09-frontend-redesign-design.md`).

## 1. Problem / Motivation

The redesigned site looks great on mobile but has rough edges on desktop, and the "right now" data feels stale. Specifically:

1. **Desktop is too thin** — the single `max-width: 460px` column leaves a wide desktop screen mostly empty.
2. **Panels aren't collapsible** — the user wants to hide sections they don't care about.
3. **History chart has no x-axis** — `BandChart` hides its x-axis, so there are no time labels.
4. **"When it's usually good" tooltip is 24-hour** — the axis ticks are 12h, but the tooltip still shows `15:00`.
5. **Data looks frozen** — two causes, confirmed by inspection:
   - The app fetches once on mount (`App.tsx` `useEffect`, no polling), so an open tab never updates.
   - GitHub throttles the every-5-min `collect` schedule to actually run **every ~30–40 min** (real commit gaps: 18:17Z, 17:44Z, 17:04Z, 16:23Z, …). The cron interval is a wish, not a guarantee, on free scheduled Actions.

**Framing decision (agreed):** the original problem this project solves is *history/at-a-glance* — the source page already only shows ~10 rows (~20 min), too little to judge how the day has trended or whether it's been good long enough to commit to an hour's drive. The live source page (`http://65.130.252.76:90/fastDC.htm`) is already the free real-time view. **We will not try to out-"live" the source.** Our site owns history + verdict and hands off to the source for real-time. Real-time via an external cron trigger is rejected: it's free in dollars but adds an account, a managed token, and a silent-failure surface for a race we don't need to win.

## 2. Goals

- Desktop uses its width well; mobile keeps the single-column stack.
- Every panel is collapsible; choices persist across visits.
- The History chart shows time on the x-axis; chart toggles persist.
- The site is *honest and convenient* about freshness rather than pretending to be live.
- History has fewer gaps.
- No new hosted services; stays free; collectors change minimally.

## 3. Design

### 3.1 Desktop layout — "Hero + tiled grid" (option C)
Responsive layout, mobile-first:
- **Mobile (default / narrow):** single column, current stack order.
- **Desktop (≥ ~720px):** `main` widens (cap ~960–1040px, centered). **Verdict** and **History** span the full width (the lull–gust band reads best wide). Below them, the three smaller panels — **Recent readings**, **When it's usually good**, **Forecast trust** — tile in a responsive grid (3-up on wide, wrapping to 2/1 as width shrinks).
- Implemented with CSS (a `.grid` wrapper + media queries / CSS grid `auto-fit`), no JS layout logic. Verdict/History are full-bleed; the rest live in the grid.

### 3.2 Collapsible panels (all open, remembered)
- A small reusable **`CollapsiblePanel`** wrapper (header with title + a chevron/▾ toggle; body shown/hidden). All panels start **expanded**.
- Collapsed state persists per-panel in `localStorage` under a namespaced key (e.g. `dc.collapsed.<id>`), so a panel the user collapses stays collapsed next visit; new/unknown panels default to open.
- A tiny `usePersistedState(key, default)` hook (localStorage-backed `useState`) powers this and the chart toggles (3.4). SSR-safe/guarded for `window` absence.
- Each existing section (`Verdict`, `HistoryChart`, `RecentReadings`, `HourPattern`, `ForecastVsActual`, `ModelScoreboard`) is wrapped in `CollapsiblePanel` with a stable id + its title. The panels' current internal `.panel`/`.section-title` markup moves into the wrapper's header/body so titles aren't duplicated.

### 3.3 History x-axis (show time, 12-hour)
- `BandChart` stops hiding its x-axis. Ticks show **12-hour time** (e.g. `1p`, `3p`, `5p`) derived from each `BandPoint.time`.
- Because Riding-mode Week packs 7 days on an ordinal index axis, hour ticks across all days would be unreadable — so: **Day view shows hour ticks**; **Week view keeps the per-day date labels** (already drawn at day boundaries) and shows sparse/edge hour context only; **Month view shows dates** (unchanged, MonthBars already has a date axis). The shared tick formatter reuses the same 12-hour helper as HourPattern.

### 3.4 Remember chart toggles
- `HistoryChart`'s `range` (Day/Week/Month) and `hours` (Riding/Full) move from plain `useState` to `usePersistedState` (`dc.chart.range`, `dc.chart.hours`), so the last-used view is restored on return. Defaults unchanged (week / riding).

### 3.5 "When it's usually good" — 12-hour tooltip
- `HourPattern`'s Recharts `Tooltip` `labelFormatter` changes from `${h}:00` to the shared 12-hour helper (e.g. `3 PM`). The axis tick formatter already yields 12h; both now use one `formatHour12(h)` util (in `theme.ts` or a small `format.ts`) to avoid drift.

### 3.6 Freshness — honest + convenient, not real-time
Three client-only changes (no backend hosting):
- **Auto-refresh:** `App.tsx` re-runs `loadData()` on an interval (**every 3 minutes**; also refetch on `visibilitychange` when the tab refocuses). `cache: "no-store"` is already set. State updates in place; no full reload.
- **"Data as of" label:** the Verdict/header shows the latest reading's time and relative age, e.g. **"data as of 12:17 · 28 min ago"**, recomputed on a lightweight ticking clock so the "N min ago" stays live. When the newest reading is older than a threshold (e.g. > 45 min) it's visually de-emphasized/flagged as stale.
- **"See live →" link:** a small link in the Right-now card to `http://65.130.252.76:90/fastDC.htm` (opens in a new tab) for authoritative real-time.

### 3.7 History completeness — close the gaps (collector, minimal)
- Each `collect` run currently fetches the source once (last ~10 rows ≈ 20 min). With ~30–40 min between runs, ~15 min of readings are missed each cycle.
- Change: within a single observations run, fetch the source **a few times spaced ~3 min apart** (e.g. 3 fetches over ~6–9 min), appending new rows each time (existing dedup handles overlap). This widens each run's coverage and largely closes inter-run gaps, for free (public repo = unlimited Actions minutes). Cap the in-run loop conservatively so a run stays well under the job timeout.
- This is the ONLY collector change; forecasts, schema, and the NDJSON format are untouched.

## 4. Components / Files (impact map)
- `web/src/hooks/usePersistedState.ts` — NEW (localStorage-backed state; guarded).
- `web/src/components/CollapsiblePanel.tsx` — NEW (header + toggle + body; persists collapsed state).
- `web/src/format.ts` (or add to `theme.ts`) — NEW `formatHour12(h)` and a `relativeAge(iso, now)` helper.
- `web/src/App.tsx` — MODIFY: responsive layout (hero full-width + `.grid`), wrap panels in `CollapsiblePanel`, polling + visibility refetch, "data as of" wiring.
- `web/src/components/chart/BandChart.tsx` — MODIFY: show x-axis with 12h ticks (Day) / keep day labels (Week).
- `web/src/components/chart/HistoryChart.tsx` — MODIFY: `usePersistedState` for range/hours.
- `web/src/components/HourPattern.tsx` — MODIFY: 12h tooltip via `formatHour12`.
- `web/src/components/Verdict.tsx` (or App header) — MODIFY: "data as of / N min ago" + "See live →" link.
- `web/src/theme.css` / `App.css` — MODIFY: desktop grid + collapsible styles.
- `collectors/src/Collectors/Runners.cs` — MODIFY: multi-fetch loop in the observations run.

## 5. Testing
- `usePersistedState`: unit-test read/write/default + missing-`window` guard.
- `CollapsiblePanel`: renders open by default; toggle hides body; persisted collapsed id starts collapsed.
- `formatHour12`/`relativeAge`: unit tests (e.g. `13→"1 PM"`, `0→"12 AM"`; age buckets).
- `HistoryChart`: persisted range/hours restored from storage (mock localStorage).
- Auto-refresh: fetch called again after the interval (fake timers) — a focused test, not the whole app.
- Existing component/analytics tests stay green. Collector: extend the observations run test to assert multiple fetches append+dedup (mock the fetch to return two overlapping windows).
- Visual checks (jsdom can't render CSS): desktop grid, collapsible chevrons, x-axis labels — verified in a dev run before merge.

## 6. Out of Scope
- Phase II per-user calibration (equipment/level/weight) — still next after this.
- Any external/hosted real-time service; light mode.

## 7. Open Assumptions (flag if wrong)
- Auto-refresh every 3 min; stale flag at > 45 min.
- Desktop breakpoint ~720px, max width ~1000px; smaller panels 3-up tiling.
- Week view keeps day labels (not per-hour ticks); Day view gets hour ticks.
- In-run collector does ~3 fetches ~3 min apart.
