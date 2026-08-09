# UI Polish & Data Freshness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard use desktop width well, give every panel a remembered collapse toggle, put 12-hour time on the charts, and make freshness honest (auto-refresh + "data as of" + a live link) — plus a small collector change to fill history gaps.

**Architecture:** Frontend-only except one C# collector tweak. A `usePersistedState` hook backs both collapsible panels and chart toggles; a `CollapsiblePanel` wrapper owns each section's header + collapse; format helpers unify 12-hour time and relative age. The App gains a responsive hero+grid layout and interval polling. The collector does a few spaced fetches per run.

**Tech Stack:** React 18 + Vite + TypeScript, Vitest + React Testing Library, Recharts, .NET 8 (collector).

## Global Constraints

- **Presentation + freshness only** (except the collector gap-fill in Task 9). Do NOT change the NDJSON schema or the `Observation`/`Forecast` types.
- **localStorage key namespace:** `dc.collapsed.<id>`, `dc.chart.range`, `dc.chart.hours`. All persistence goes through `usePersistedState` (guarded for missing `window`).
- **Field theme + Space Grotesk** unchanged; all new styling uses the existing CSS variables in `theme.css`.
- **Time formats:** compact `formatHourShort(h)` → e.g. `1p`/`12a`; long `formatHour12(h)` → e.g. `1 PM`/`12 AM`. Charts use these, never raw 24-hour.
- **Freshness:** auto-refresh every **3 minutes** + refetch on tab `visibilitychange`; "data as of HH:MM · N min ago" label; flag stale when newest reading > **45 min** old. Live link → `http://65.130.252.76:90/fastDC.htm` (new tab).
- **Desktop layout:** mobile = single column; at **≥720px** `main` widens (max ~1000px). Verdict + History full-width; Recent / Usually-good / Forecast tile in a responsive grid (`auto-fit`, min ~280px). All panels collapsible; all start expanded.
- **Collector:** each observations run does ~**3 fetches spaced ~3 min apart**, deduped by time before append; forecasts/schema untouched.
- **Node/npm not on PATH:** prefix node/npm/npx with `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH"` (Git Bash). Recharts renders 0×0 in jsdom — component tests assert containers/state/text, not pixels; visual correctness is a dev-run check before merge.
- **TDD**, pristine test output, frequent conventional commits.

---

## File Structure

```
web/src/
  hooks/usePersistedState.ts        # NEW — localStorage-backed useState
  format.ts                         # NEW — formatHourShort, formatHour12, relativeAge
  components/CollapsiblePanel.tsx    # NEW — header (title + chevron) + collapsible body
  components/Verdict.tsx             # MODIFY — inner-content only; add "See live →"
  components/RecentReadings.tsx      # MODIFY — inner-content only (drop own panel/title)
  components/HourPattern.tsx         # MODIFY — inner-content only; 12h axis + tooltip
  components/ForecastVsActual.tsx    # MODIFY — inner-content only
  components/ModelScoreboard.tsx     # MODIFY — inner-content only
  components/chart/HistoryChart.tsx  # MODIFY — inner-content only; persist range/hours
  components/chart/BandChart.tsx     # MODIFY — show 12h x-axis on Day view
  App.tsx                           # MODIFY — hero+grid layout, wrap panels, polling, data-as-of
  theme.css                         # MODIFY — grid + collapsible + freshness styles
collectors/src/Collectors/Runners.cs # MODIFY — multi-fetch observations run
```

"Inner-content only" means: the component stops rendering its own `<section className="panel …">` wrapper and its title element, rendering just its inner content (keeping its specific class, e.g. `.hour-pattern`, on the root element). `CollapsiblePanel` (Task 3) supplies the panel chrome + title. Component tests key off content/inner classes, not the title, so they stay green.

---

## Task 1: `usePersistedState` hook

**Files:** Create `web/src/hooks/usePersistedState.ts`, `web/src/hooks/usePersistedState.test.ts`

**Interfaces:**
- Produces: `export function usePersistedState<T>(key: string, initial: T): [T, (v: T) => void]` — reads initial from `localStorage[key]` (JSON) or falls back to `initial`; writes on change; guarded against missing `window`/parse errors.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistedState } from "./usePersistedState";

describe("usePersistedState", () => {
  beforeEach(() => localStorage.clear());
  it("returns the initial value when nothing stored", () => {
    const { result } = renderHook(() => usePersistedState("k", "def"));
    expect(result.current[0]).toBe("def");
  });
  it("persists and restores across mounts", () => {
    const a = renderHook(() => usePersistedState("k", "def"));
    act(() => a.result.current[1]("changed"));
    expect(localStorage.getItem("k")).toBe(JSON.stringify("changed"));
    const b = renderHook(() => usePersistedState("k", "def"));
    expect(b.result.current[0]).toBe("changed");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/hooks/usePersistedState.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { useEffect, useState } from "react";

export function usePersistedState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [key, value]);
  return [value, setValue];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/hooks/usePersistedState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/usePersistedState.ts web/src/hooks/usePersistedState.test.ts
git commit -m "feat: usePersistedState localStorage hook"
```

---

## Task 2: Time/age format helpers

**Files:** Create `web/src/format.ts`, `web/src/format.test.ts`

**Interfaces:**
- `export function formatHourShort(h: number): string` — `13→"1p"`, `0→"12a"`, `12→"12p"`, `23→"11p"` (wraps mod 24).
- `export function formatHour12(h: number): string` — `13→"1 PM"`, `0→"12 AM"`, `12→"12 PM"`.
- `export function relativeAge(iso: string, nowMs: number): string` — `<1→"just now"`, `<60→"N min ago"`, else `"Hh Mm ago"`/`"Hh ago"` (clamped ≥ 0).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { formatHourShort, formatHour12, relativeAge } from "./format";

describe("format", () => {
  it("formatHourShort", () => {
    expect(formatHourShort(13)).toBe("1p");
    expect(formatHourShort(0)).toBe("12a");
    expect(formatHourShort(12)).toBe("12p");
    expect(formatHourShort(23)).toBe("11p");
  });
  it("formatHour12", () => {
    expect(formatHour12(13)).toBe("1 PM");
    expect(formatHour12(0)).toBe("12 AM");
    expect(formatHour12(12)).toBe("12 PM");
  });
  it("relativeAge", () => {
    const now = Date.parse("2026-08-09T12:45:00-06:00");
    expect(relativeAge("2026-08-09T12:45:00-06:00", now)).toBe("just now");
    expect(relativeAge("2026-08-09T12:17:00-06:00", now)).toBe("28 min ago");
    expect(relativeAge("2026-08-09T10:30:00-06:00", now)).toBe("2h 15m ago");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/format.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export function formatHourShort(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  const d = hr % 12 === 0 ? 12 : hr % 12;
  return `${d}${hr < 12 ? "a" : "p"}`;
}

export function formatHour12(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  const d = hr % 12 === 0 ? 12 : hr % 12;
  return `${d} ${hr < 12 ? "AM" : "PM"}`;
}

export function relativeAge(iso: string, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m ago` : `${h}h ago`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/format.ts web/src/format.test.ts
git commit -m "feat: 12-hour time and relative-age format helpers"
```

---

## Task 3: `CollapsiblePanel`

**Files:** Create `web/src/components/CollapsiblePanel.tsx`, `web/src/components/CollapsiblePanel.test.tsx`; Modify `web/src/theme.css`

**Interfaces:**
- Consumes: `usePersistedState`.
- Produces: `export function CollapsiblePanel({ id, title, children }: { id: string; title: string; children: React.ReactNode }): JSX.Element` — a `.panel` with a `.panel-head` button (`.section-title` + a chevron, `aria-expanded`) that toggles a `.panel-body`; collapsed state persisted under `dc.collapsed.${id}`, default expanded.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { CollapsiblePanel } from "./CollapsiblePanel";

describe("CollapsiblePanel", () => {
  beforeEach(() => localStorage.clear());
  it("starts expanded, shows title + body", () => {
    render(<CollapsiblePanel id="x" title="History"><p>body</p></CollapsiblePanel>);
    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });
  it("collapses on click and persists", () => {
    const { unmount } = render(<CollapsiblePanel id="x" title="History"><p>body</p></CollapsiblePanel>);
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    expect(screen.queryByText("body")).toBeNull();
    unmount();
    render(<CollapsiblePanel id="x" title="History"><p>body</p></CollapsiblePanel>);
    expect(screen.queryByText("body")).toBeNull(); // restored collapsed
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/CollapsiblePanel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
import { usePersistedState } from "../hooks/usePersistedState";

export function CollapsiblePanel({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = usePersistedState<boolean>(`dc.collapsed.${id}`, false);
  return (
    <section className="panel">
      <button className="panel-head" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
        <span className="section-title">{title}</span>
        <span className="chev">{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && <div className="panel-body">{children}</div>}
    </section>
  );
}
```

Append to `web/src/theme.css`:
```css
.panel-head { display: flex; justify-content: space-between; align-items: center; width: 100%; background: none; border: none; padding: 0; margin: 0 0 10px; cursor: pointer; color: inherit; font: inherit; }
.panel-head .chev { color: var(--faint); font-size: 12px; }
.panel-body { display: block; }
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/CollapsiblePanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/CollapsiblePanel.tsx web/src/components/CollapsiblePanel.test.tsx web/src/theme.css
git commit -m "feat: CollapsiblePanel with persisted collapse state"
```

---

## Task 4: 12-hour time on charts

**Files:** Modify `web/src/components/chart/BandChart.tsx`, `web/src/components/HourPattern.tsx`

**Interfaces:**
- Consumes: `formatHourShort`, `formatHour12` (format.ts), `localHour` (analytics.ts).
- BandChart: x-axis is shown with 12h hour ticks on the **Day** view (`hide={showDayLabels}` — Week keeps its day-boundary labels, Day shows hours); tick label = `formatHourShort(localHour(point.time))`.
- HourPattern: axis tick = `formatHourShort(h)`; tooltip label = `formatHour12(h)`.

- [ ] **Step 1: Update BandChart** — replace the `<XAxis dataKey="i" hide />` line with a shown-on-Day axis:

```tsx
<XAxis
  dataKey="i"
  hide={showDayLabels}
  type="number"
  domain={["dataMin", "dataMax"]}
  tick={{ fill: "#64748b", fontSize: 10 }}
  minTickGap={44}
  tickFormatter={(i) => {
    const p = points.find((q) => q.i === i);
    return p ? formatHourShort(localHour(p.time)) : "";
  }}
/>
```
Add imports at the top of BandChart.tsx: `import { formatHourShort } from "../../format";` and `import { localHour } from "../../analytics";`.

- [ ] **Step 2: Update HourPattern** — change the axis + tooltip formatters:

Replace the `XAxis` `tickFormatter` with `tickFormatter={(h) => formatHourShort(h)}` and the `Tooltip` `labelFormatter` with `labelFormatter={(h) => formatHour12(Number(h))}`. Add `import { formatHourShort, formatHour12 } from "../format";` and remove the old inline `((h + 11) % 12) + 1` formatter.

- [ ] **Step 3: Run the affected tests + build**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/BandChart.test.tsx src/components/HourPattern.test.tsx && npm run build`
Expected: both tests PASS (containers/empty states unchanged); build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/chart/BandChart.tsx web/src/components/HourPattern.tsx
git commit -m "feat: 12-hour time on History x-axis and HourPattern tooltip"
```

---

## Task 5: Persist HistoryChart toggles

**Files:** Modify `web/src/components/chart/HistoryChart.tsx`, `web/src/components/chart/HistoryChart.test.tsx`

**Interfaces:**
- Consumes: `usePersistedState`.
- `range` and `hours` state move to `usePersistedState("dc.chart.range", "week")` and `usePersistedState("dc.chart.hours", "riding")`; defaults unchanged; the last-used view is restored.

- [ ] **Step 1: Add the failing persistence test** to `HistoryChart.test.tsx`:

```tsx
it("restores the persisted range from storage", () => {
  localStorage.setItem("dc.chart.range", JSON.stringify("month"));
  const { container } = render(<HistoryChart observations={obs} nowMs={now} />);
  expect(container.querySelector(".month-bars")).toBeTruthy();
});
```
Add `beforeEach(() => localStorage.clear());` inside the describe if not present, and ensure the existing default test still clears storage first.

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/HistoryChart.test.tsx`
Expected: FAIL (still plain useState — storage ignored).

- [ ] **Step 3: Implement** — in `HistoryChart.tsx`, replace the two `useState` lines:

```tsx
import { usePersistedState } from "../../hooks/usePersistedState";
// ...
const [range, setRange] = usePersistedState<Range>("dc.chart.range", "week");
const [hours, setHours] = usePersistedState<HoursMode>("dc.chart.hours", "riding");
```
Remove the now-unused `useState` import if nothing else uses it.

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/HistoryChart.test.tsx`
Expected: PASS (default + persisted-restore + month-switch).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/chart/HistoryChart.tsx web/src/components/chart/HistoryChart.test.tsx
git commit -m "feat: remember History range/hours toggles"
```

---

## Task 6: Strip panel chrome from content components + Verdict "See live" link

**Files:** Modify `Verdict.tsx`, `RecentReadings.tsx`, `HourPattern.tsx`, `ForecastVsActual.tsx`, `ModelScoreboard.tsx`, `components/chart/HistoryChart.tsx`

Each component stops rendering its own `<section className="panel …">` wrapper and its title, rendering inner content only (keeping its distinctive class on the root `<div>`). `CollapsiblePanel` will supply panel + title in Task 7. Existing component tests key off inner content/classes and stay green.

**Interfaces:** signatures unchanged.

- [ ] **Step 1: Verify green baseline**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components`
Expected: PASS.

- [ ] **Step 2: Edit each component's wrapper** (content unchanged inside):

- **Verdict.tsx:** change the populated return's outer `<section className="panel verdict">…</section>` to `<div className="verdict">…</div>`; change the null return `<section className="panel"><h1>No data yet</h1></section>` to `<div className="verdict"><p>No data yet</p></div>`. Inside the populated `.verdict-head`, add a live link after the time span:
  ```tsx
  <a className="live-link" href="http://65.130.252.76:90/fastDC.htm" target="_blank" rel="noreferrer">See live →</a>
  ```
- **RecentReadings.tsx:** the populated return outer becomes `<div className="recent">…`; drop the `.section-title` "Recent readings" span (keep the CSV button; move it into a `.recent-head` that now holds only the button, right-aligned). Empty state → `<div className="recent"><p>No readings yet</p></div>`.
- **HourPattern.tsx:** outer `<section className="panel hour-pattern">` → `<div className="hour-pattern">`; drop the `.section-title`. Empty → `<div className="hour-pattern"><p>Not enough data yet</p></div>`.
- **ForecastVsActual.tsx:** outer `<section className="panel forecast-actual">` → `<div className="forecast-actual">`; drop the title span. Empty state keeps its text in a `<div className="forecast-actual">`.
- **ModelScoreboard.tsx:** outer `<section className="panel model-scoreboard">` → `<div className="model-scoreboard">` (both populated and empty); drop the title span.
- **chart/HistoryChart.tsx:** outer `<section className="panel history">` → `<div className="history">`; drop the "History" `.section-title` from `.history-head` (keep the range chips + hours toggle).

Append to `theme.css`:
```css
.live-link { font-size: 12px; color: var(--accent); text-decoration: none; }
```

- [ ] **Step 3: Run the component + build gates**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components`
Expected: PASS (tests key off inner classes/text, not titles). NOTE: `npm run build` will fail here only if `App.tsx` references titles that moved — leave App.tsx for Task 7; the component tests are the gate for this task.

- [ ] **Step 4: Commit**

```bash
git add web/src/components
git commit -m "refactor: components render inner content only; add See live link"
```

---

## Task 7: App layout — hero + grid + CollapsiblePanel wrapping

**Files:** Modify `web/src/App.tsx`, `web/src/theme.css`, `web/src/App.test.tsx`

**Interfaces:**
- Consumes: `CollapsiblePanel` + all components.
- App renders each section wrapped in `CollapsiblePanel` with a stable id + title; Verdict and History are full-width; Recent/HourPattern/Forecast/Scoreboard tile in a `.grid`. Section titles: `Right now`, `History`, `Recent readings`, `When it's usually good`, `Forecast vs actual`, `Which forecast to trust`.

- [ ] **Step 1: Rewrite `App.tsx`** (keep the existing data-loading/`latest` logic; wrap + lay out):

```tsx
import { useEffect, useState } from "react";
import { loadData } from "./dataLoader";
import type { Observation, Forecast } from "./types";
import { CollapsiblePanel } from "./components/CollapsiblePanel";
import { Verdict } from "./components/Verdict";
import { HistoryChart } from "./components/chart/HistoryChart";
import { RecentReadings } from "./components/RecentReadings";
import { HourPattern } from "./components/HourPattern";
import { ForecastVsActual } from "./components/ForecastVsActual";
import { ModelScoreboard } from "./components/ModelScoreboard";
import "./App.css";

export default function App() {
  const [obs, setObs] = useState<Observation[]>([]);
  const [fc, setFc] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData().then(({ observations, forecasts }) => { setObs(observations); setFc(forecasts); setLoading(false); });
  }, []);

  const latest = obs.length ? obs.reduce((a, b) => (a.time > b.time ? a : b)) : null;

  return (
    <main>
      <header className="app-head">
        <div><div className="app-title">Barbed Wire Beach</div><div className="app-sub">Deer Creek Reservoir</div></div>
        <span className="live">● live</span>
      </header>
      {loading ? <p>Loading…</p> : (
        <>
          <CollapsiblePanel id="now" title="Right now"><Verdict latest={latest} /></CollapsiblePanel>
          <CollapsiblePanel id="history" title="History"><HistoryChart observations={obs} /></CollapsiblePanel>
          <div className="grid">
            <CollapsiblePanel id="recent" title="Recent readings"><RecentReadings observations={obs} /></CollapsiblePanel>
            <CollapsiblePanel id="usually" title="When it's usually good"><HourPattern observations={obs} /></CollapsiblePanel>
            <CollapsiblePanel id="vs" title="Forecast vs actual"><ForecastVsActual observations={obs} forecasts={fc} /></CollapsiblePanel>
            <CollapsiblePanel id="trust" title="Which forecast to trust"><ModelScoreboard observations={obs} forecasts={fc} /></CollapsiblePanel>
          </div>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Update `App.test.tsx`** — the header assertion still holds; add a grid presence check:

```tsx
await waitFor(() => expect(screen.getByText(/Barbed Wire Beach/i)).toBeTruthy());
expect(document.querySelector(".grid")).toBeTruthy();
```

- [ ] **Step 3: Replace the layout rules in `App.css`** and add grid/desktop styles:

```css
main { max-width: 460px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.grid { display: grid; gap: 14px; grid-template-columns: 1fr; }
@media (min-width: 720px) {
  main { max-width: 1000px; }
  .grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
}
```

- [ ] **Step 4: Run full suite + build**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npm test && npm run build`
Expected: ALL tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/App.tsx web/src/App.test.tsx web/src/App.css
git commit -m "feat: hero + responsive grid layout with collapsible panels"
```

---

## Task 8: App freshness — auto-refresh + "data as of / N min ago" + stale flag

**Files:** Modify `web/src/App.tsx`, `web/src/App.test.tsx`, `web/src/theme.css`

**Interfaces:**
- Consumes: `relativeAge` (format.ts).
- App refetches every 3 min and on `visibilitychange` (when visible); a live-ticking `nowMs` drives a header label "data as of HH:MM · N min ago"; when the newest reading is > 45 min old the label carries a `stale` class.

- [ ] **Step 1: Add the failing polling test** to `App.test.tsx` (fake timers):

```tsx
import { vi } from "vitest";
it("refetches on an interval", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "" }) as any);
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  await vi.runOnlyPendingTimersAsync();
  const initial = fetchMock.mock.calls.length; // 2 files on mount
  await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
  expect(fetchMock.mock.calls.length).toBeGreaterThan(initial);
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/App.test.tsx`
Expected: FAIL (no interval yet).

- [ ] **Step 3: Implement** — extend `App.tsx`:

Add near the top of the component:
```tsx
const [nowMs, setNowMs] = useState(() => Date.now());

useEffect(() => {
  const refresh = () => loadData().then(({ observations, forecasts }) => { setObs(observations); setFc(forecasts); });
  const poll = setInterval(refresh, 3 * 60 * 1000);
  const clock = setInterval(() => setNowMs(Date.now()), 30 * 1000);
  const onVis = () => { if (document.visibilityState === "visible") refresh(); };
  document.addEventListener("visibilitychange", onVis);
  return () => { clearInterval(poll); clearInterval(clock); document.removeEventListener("visibilitychange", onVis); };
}, []);
```
Replace the header's `<span className="live">● live</span>` with an age label:
```tsx
{latest
  ? (() => {
      const ageMin = Math.round((nowMs - Date.parse(latest.time)) / 60000);
      return <span className={`asof${ageMin > 45 ? " stale" : ""}`}>
        data as of {new Date(latest.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {relativeAge(latest.time, nowMs)}
      </span>;
    })()
  : <span className="asof">—</span>}
```
Add `import { relativeAge } from "./format";`. (The existing mount-`useEffect` stays; this second effect adds polling/clock/visibility. `nowMs` in the header uses the `latest` computed below — move the `latest` line above the return as it already is.)

Append to `theme.css`:
```css
.asof { font-size: 11px; color: var(--faint); }
.asof.stale { color: var(--gusty); }
```

- [ ] **Step 4: Run full suite + build**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npm test && npm run build`
Expected: ALL pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/App.tsx web/src/App.test.tsx web/src/theme.css
git commit -m "feat: auto-refresh + honest data-as-of/stale label"
```

---

## Task 9: Collector gap-fill — multiple spaced fetches per run

**Files:** Modify `collectors/src/Collectors/Runners.cs`; Test `collectors/test/Collectors.Tests/BeachObservationTests.cs`

**Interfaces:**
- Produces: `public static IReadOnlyList<Observation> ObservationsRunner.MergeDistinct(IEnumerable<Observation> all)` — distinct by `time`, ascending. `RunAsync` fetches `FetchesPerRun` (=3) times, `FetchSpacing` (=3 min) apart, accumulates via `BuildObservations`, merges distinct, appends once.

- [ ] **Step 1: Write the failing test** (append to `BeachObservationTests.cs`)

```csharp
[Fact]
public void MergeDistinct_dedupes_by_time_and_sorts()
{
    var t1 = new DateTimeOffset(2026, 8, 9, 14, 40, 0, TimeSpan.FromHours(-6));
    var t2 = new DateTimeOffset(2026, 8, 9, 14, 42, 0, TimeSpan.FromHours(-6));
    var t3 = new DateTimeOffset(2026, 8, 9, 14, 44, 0, TimeSpan.FromHours(-6));
    var all = new[]
    {
        new Observation(t2, 90, "SW", 15, 20), new Observation(t1, 90, "SW", 14, 19),
        new Observation(t3, 90, "SW", 16, 21), new Observation(t2, 90, "SW", 15, 20), // dup t2
    };
    var merged = Collectors.ObservationsRunner.MergeDistinct(all);
    Assert.Equal(3, merged.Count);
    Assert.Equal(t1, merged[0].time);
    Assert.Equal(t3, merged[2].time);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test collectors/Collectors.sln --filter BeachObservationTests`
Expected: FAIL (`MergeDistinct` not found).

- [ ] **Step 3: Implement** — add `MergeDistinct` and use a fetch loop in `ObservationsRunner.RunAsync`:

```csharp
private const int FetchesPerRun = 3;
private static readonly TimeSpan FetchSpacing = TimeSpan.FromMinutes(3);

public static IReadOnlyList<Observation> MergeDistinct(IEnumerable<Observation> all)
{
    var byTime = new Dictionary<DateTimeOffset, Observation>();
    foreach (var o in all) byTime[o.time] = o;
    return byTime.Values.OrderBy(o => o.time).ToList();
}
```
In `RunAsync`, replace the single fetch+build with:
```csharp
var collected = new List<Observation>();
for (var f = 0; f < FetchesPerRun; f++)
{
    try
    {
        var html = await http.GetStringAsync(Url);
        collected.AddRange(BuildObservations(html, DateTimeOffset.UtcNow));
    }
    catch (Exception ex) { Console.Error.WriteLine($"fetch {f} failed: {ex.Message}"); }
    if (f < FetchesPerRun - 1) await Task.Delay(FetchSpacing);
}
var obs = MergeDistinct(collected);
if (obs.Count == 0) { Console.Error.WriteLine("0 rows parsed; writing nothing"); return 1; }
```
(keep the existing directory-create + `AppendNewObservations` + return-0 tail).

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test collectors/Collectors.sln`
Expected: all PASS (existing + the new MergeDistinct test).

- [ ] **Step 5: Commit**

```bash
git add collectors/src/Collectors/Runners.cs collectors/test/Collectors.Tests/BeachObservationTests.cs
git commit -m "feat: collector does spaced multi-fetch per run to close history gaps"
```

---

## Self-Review Notes (author)

- **Spec coverage:** desktop hero+grid (§3.1 → T7), collapsible + persistence (§3.2 → T1/T3/T6/T7), History x-axis 12h (§3.3 → T4), remember toggles (§3.4 → T5), 12h tooltip (§3.5 → T4), auto-refresh + data-as-of + live link + stale (§3.6 → T6 link, T8), gap-fill (§3.7 → T9). Files map to §4; tests to §5.
- **Type consistency:** `usePersistedState<T>` (T1) reused by CollapsiblePanel (T3) and HistoryChart (T5); `formatHourShort`/`formatHour12`/`relativeAge` (T2) consumed by T4/T8; component "inner-content only" refactor (T6) is what makes CollapsiblePanel titles (T7) non-duplicative.
- **Transient build state:** T6 strips titles that App still referenced; T7 restores a green full build. Same pattern used successfully in the redesign; each task's stated gate (component vitest for T6, full suite+build for T7) reflects this.
- **Rendering caveat:** BandChart/HourPattern visual results (axis ticks) are verified by build + a dev run; unit tests assert containers/state only.
