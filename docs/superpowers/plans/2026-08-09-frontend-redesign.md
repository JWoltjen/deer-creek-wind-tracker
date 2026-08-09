# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dashboard UI in the dark "Field" style — a quiet verdict, a lull↔gust band chart with Day/Week/Month + Riding/Full controls, and always-visible recent readings — keeping lull and gust distinct everywhere.

**Architecture:** Presentation-only change over the existing React+Vite+TS app. Pure data transforms (riding-hours filtering, band-point shaping, month aggregation) are TDD'd in isolation; components consume them and render with a shared Field theme (CSS variables + a category-color map). Collectors and the NDJSON data model are untouched.

**Tech Stack:** React 18 + Vite + TypeScript, Vitest + React Testing Library, Recharts (range `Area` for the band), `@fontsource/space-grotesk`.

## Global Constraints

- **Presentation + config only.** Do NOT change `collectors/`, the NDJSON schema, or the `Observation`/`Forecast` types.
- **Keep lull (`low`) and gust (`high`) distinct in every visualization.** No chart may plot `mid=(low+high)/2` as its primary series.
- **Field palette (verbatim, as CSS variables in `web/src/theme.css`):** bg `#0b1220`, panel `#0e1729`, border `#1e293b`, hairline `#16213a`, text `#e6edf6`, muted `#94a3b8`, faint `#64748b`, dim `#475569`, accent/gust `#22d3ee`, lull `#0e7490`, good `#22d3ee`, gusty `#f59e0b`, strong `#ef4444`, too-light `#334155`.
- **Category colors (TS map in `web/src/theme.ts`):** `good:#22d3ee, gusty:#f59e0b, strong:#ef4444, light:#334155`.
- **Typeface:** Space Grotesk via `@fontsource/space-grotesk` (self-hosted, no network `<link>`), system-sans fallback. No emoji in headings.
- **Riding window (config, tunable):** `ridingStartHour=11`, `ridingEndHour=19`, inclusive both ends. **Prime core:** `primeStartHour=12.5`, `primeEndHour=17`.
- **Config is the single source of truth** for thresholds/windows/theme (sets up Phase II).
- **Dark-only** (no light mode). **TDD** for all pure logic; test output pristine; frequent conventional commits.
- **Node/npm are not on PATH by default** on the dev machine — prefix node/npm/npx commands with `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH"` (Git Bash).
- **Charts render at 0×0 in jsdom** — component tests assert container classes, empty states, and control behavior, NOT pixel output. Visual correctness is verified by `npm run build` + a dev run at the end.

---

## File Structure

```
web/src/
  theme.css            # NEW — CSS variables (Field palette) + base element/reset styling
  theme.ts             # NEW — categoryColor map + small style helpers
  config.ts            # MODIFY — add riding/prime windows + remove dayStart/End
  classify.ts          # MODIFY — add steadiness(low,high)
  analytics.ts         # MODIFY — rename day-window → riding-window; add hourDecimal
  chartData.ts         # NEW — ridingHoursFilter, sliceByRange, bandPoints, dayBoundaries, primeRanges, dailyBars
  components/
    Verdict.tsx        # REWRITE — Field hero, lull→gust, quiet chip, steadiness line
    HourPattern.tsx    # MODIFY — Field styling, riding-hours, category colors
    ForecastVsActual.tsx  # MODIFY — Field styling
    ModelScoreboard.tsx   # MODIFY — Field styling
    RecentReadings.tsx    # NEW — always-visible recent list + CSV button
    DataTable.tsx      # DELETE (replaced by RecentReadings + CSV)
    chart/
      BandChart.tsx    # NEW — Day/Week lull–gust band (Recharts range Area)
      MonthBars.tsx    # NEW — one lull–gust bar per day
      HistoryChart.tsx # NEW — range+hours state, controls, composes Band/Month
  App.tsx              # REWRITE — layout/order + theme import
  App.css              # REPLACE dead Vite CSS with imports/minimal glue
```

Existing `HistoryChart.tsx` (flat, at `components/`) is superseded by `components/chart/HistoryChart.tsx`; delete the old one in Task 8.

---

## Stage A — Foundations

### Task 1: Field theme (fonts, CSS variables, delete dead CSS, category colors)

**Files:**
- Create: `web/src/theme.css`, `web/src/theme.ts`
- Modify: `web/src/App.css` (delete Vite template CSS), `web/src/main.tsx` (import theme)
- Test: `web/src/theme.test.ts`

**Interfaces:**
- Produces: `web/src/theme.ts` → `export const categoryColor: Record<Category, string>` and `export const CAT_LABEL: Record<Category, string>` (`good:"Good", gusty:"Gusty", light:"Too light", strong:"Strong"`).

- [ ] **Step 1: Install the font package**

```bash
export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH"
cd web && npm install @fontsource/space-grotesk
```

- [ ] **Step 2: Write the failing test** (`web/src/theme.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { categoryColor, CAT_LABEL } from "./theme";

describe("theme", () => {
  it("maps every category to a color", () => {
    expect(categoryColor.good).toBe("#22d3ee");
    expect(categoryColor.gusty).toBe("#f59e0b");
    expect(categoryColor.strong).toBe("#ef4444");
    expect(categoryColor.light).toBe("#334155");
  });
  it("has a human label per category", () => {
    expect(CAT_LABEL.good).toBe("Good");
    expect(CAT_LABEL.light).toBe("Too light");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/theme.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `web/src/theme.ts`**

```ts
import type { Category } from "./classify";

export const categoryColor: Record<Category, string> = {
  good: "#22d3ee",
  gusty: "#f59e0b",
  strong: "#ef4444",
  light: "#334155",
};

export const CAT_LABEL: Record<Category, string> = {
  good: "Good",
  gusty: "Gusty",
  light: "Too light",
  strong: "Strong",
};
```

- [ ] **Step 5: Create `web/src/theme.css`** (palette + base)

```css
@import "@fontsource/space-grotesk/400.css";
@import "@fontsource/space-grotesk/500.css";
@import "@fontsource/space-grotesk/700.css";

:root {
  --bg: #0b1220; --panel: #0e1729; --border: #1e293b; --hairline: #16213a;
  --text: #e6edf6; --muted: #94a3b8; --faint: #64748b; --dim: #475569;
  --accent: #22d3ee; --lull: #0e7490;
  --good: #22d3ee; --gusty: #f59e0b; --strong: #ef4444; --light: #334155;
  --font: "Space Grotesk", system-ui, sans-serif;
}
* { box-sizing: border-box; }
html, body, #root { margin: 0; background: var(--bg); color: var(--text); }
body { font-family: var(--font); -webkit-font-smoothing: antialiased; }
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
h1, h2, h3 { margin: 0; font-weight: 700; }
```

- [ ] **Step 6: Replace `web/src/App.css` entirely** with only real glue (delete ALL Vite template CSS — `.counter`, `.hero`, `#center`, `#next-steps`, `#docs`, `#spacer`, `.ticks`, etc.):

```css
main { max-width: 460px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.section-title { font-size: 14px; font-weight: 700; }
```

- [ ] **Step 7: Import theme in `web/src/main.tsx`** — add `import "./theme.css";` above the existing `import "./App.css"` (or wherever styles are imported).

- [ ] **Step 8: Run tests + build**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/theme.test.ts && npm run build`
Expected: test PASS; build succeeds.

- [ ] **Step 9: Commit**

```bash
git add web/src/theme.css web/src/theme.ts web/src/theme.test.ts web/src/App.css web/src/main.tsx web/package.json web/package-lock.json
git commit -m "feat: Field theme foundation; remove dead Vite CSS"
```

---

### Task 2: Config riding-window + analytics rename

**Files:**
- Modify: `web/src/config.ts`, `web/src/analytics.ts`, `web/src/analytics.test.ts`

**Interfaces:**
- Produces (config): removes `dayStartHour`/`dayEndHour`; adds `ridingStartHour=11`, `ridingEndHour=19`, `primeStartHour=12.5`, `primeEndHour=17`.
- Produces (analytics): `export function hourDecimal(iso: string): number` (hour + minutes/60 from the ISO string); `inRiding(h)` uses `h >= ridingStartHour && h <= ridingEndHour` (inclusive). `actualDailyPeak`/`forecastDailyPeak` use the riding window.

- [ ] **Step 1: Update the failing test** (`web/src/analytics.test.ts`) — add boundary + hourDecimal cases; import `hourDecimal`:

```ts
import { localHour, localDate, hourDecimal, hourPattern, actualDailyPeak, forecastDailyPeak, scoreboard } from "./analytics";

describe("riding window", () => {
  it("hourDecimal includes minutes", () => {
    expect(hourDecimal("2026-08-08T12:30:00-06:00")).toBeCloseTo(12.5, 3);
  });
  it("11:00 is in the riding window, 10:00 and 20:00 are out", () => {
    const at = (h: string) => actualDailyPeak([
      { time: `2026-08-08T${h}:00:00-06:00`, tempF: 90, dir: "SW", low: 18, high: 22 },
    ]);
    expect(at("11").get("2026-08-08")).toBe(20);
    expect(at("19").get("2026-08-08")).toBe(20);
    expect(at("10").size).toBe(0);
    expect(at("20").size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/analytics.test.ts`
Expected: FAIL (`hourDecimal` not exported; 20:00/10:00 currently pass the old 9–20 window differently).

- [ ] **Step 3: Update `web/src/config.ts`** — replace the `dayStartHour`/`dayEndHour` lines with:

```ts
  ridingStartHour: 11,
  ridingEndHour: 19,
  primeStartHour: 12.5,
  primeEndHour: 17,
```

- [ ] **Step 4: Update `web/src/analytics.ts`** — add `hourDecimal`, and change the window predicate:

```ts
export function hourDecimal(iso: string): number {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? Number(m[1]) + Number(m[2]) / 60 : new Date(iso).getHours();
}

const inRiding = (h: number) => h >= config.ridingStartHour && h <= config.ridingEndHour;
```
Replace every use of the old `inDay(...)` with `inRiding(...)` (in `actualDailyPeak` and `forecastDailyPeak`). Delete the old `inDay` definition and any `dayStartHour`/`dayEndHour` references.

- [ ] **Step 5: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/analytics.test.ts`
Expected: PASS (all, including new boundary cases).

- [ ] **Step 6: Commit**

```bash
git add web/src/config.ts web/src/analytics.ts web/src/analytics.test.ts
git commit -m "feat: riding-window config; analytics uses riding hours"
```

---

## Stage B — Chart data helpers (pure, TDD)

### Task 3: Riding filter, range slice, band points, day boundaries

**Files:**
- Create: `web/src/chartData.ts`, `web/src/chartData.test.ts`

**Interfaces:**
- Produces:
  - `export type HoursMode = "riding" | "full";`
  - `export type Range = "day" | "week" | "month";`
  - `export interface BandPoint { i: number; time: string; low: number; high: number; range: [number, number]; category: Category; dayKey: string; isPrime: boolean; }`
  - `export function ridingHoursFilter(obs: Observation[], mode: HoursMode): Observation[]`
  - `export function sliceByRange(obs: Observation[], range: Range, nowMs: number): Observation[]`
  - `export function bandPoints(obs: Observation[]): BandPoint[]` (sorted ascending by `time`; `i` sequential from 0; `range=[low,high]`; `category=classify(low,high)`; `dayKey=localDate(time)`; `isPrime` from `hourDecimal` within prime window)
  - `export function dayBoundaries(points: BandPoint[]): number[]` (each `i` where `dayKey` changes from the previous point)

- [ ] **Step 1: Write the failing test** (`web/src/chartData.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { ridingHoursFilter, sliceByRange, bandPoints, dayBoundaries } from "./chartData";
import type { Observation } from "./types";

const o = (time: string, low = 15, high = 20): Observation => ({ time, tempF: 90, dir: "SW", low, high });

describe("ridingHoursFilter", () => {
  const data = [o("2026-08-08T09:00:00-06:00"), o("2026-08-08T13:00:00-06:00"), o("2026-08-08T21:00:00-06:00")];
  it("riding keeps only 11–19", () => {
    expect(ridingHoursFilter(data, "riding").map((x) => x.time)).toEqual(["2026-08-08T13:00:00-06:00"]);
  });
  it("full keeps all", () => {
    expect(ridingHoursFilter(data, "full")).toHaveLength(3);
  });
});

describe("sliceByRange", () => {
  const now = Date.parse("2026-08-08T18:00:00-06:00");
  const data = [o("2026-08-01T13:00:00-06:00"), o("2026-08-07T13:00:00-06:00"), o("2026-08-08T13:00:00-06:00")];
  it("day keeps last 24h", () => expect(sliceByRange(data, "day", now)).toHaveLength(1));
  it("week keeps last 7d", () => expect(sliceByRange(data, "week", now)).toHaveLength(2));
  it("month keeps last 30d", () => expect(sliceByRange(data, "month", now)).toHaveLength(3));
});

describe("bandPoints", () => {
  it("shapes points with range, category, dayKey, prime flag", () => {
    const pts = bandPoints([o("2026-08-08T13:00:00-06:00", 16, 20), o("2026-08-09T09:00:00-06:00", 8, 12)]);
    expect(pts[0]).toMatchObject({ i: 0, range: [16, 20], category: "good", dayKey: "2026-08-08", isPrime: true });
    expect(pts[1]).toMatchObject({ i: 1, category: "light", dayKey: "2026-08-09", isPrime: false });
  });
});

describe("dayBoundaries", () => {
  it("marks indices where the day changes", () => {
    const pts = bandPoints([o("2026-08-08T13:00:00-06:00"), o("2026-08-08T14:00:00-06:00"), o("2026-08-09T13:00:00-06:00")]);
    expect(dayBoundaries(pts)).toEqual([2]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/chartData.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `web/src/chartData.ts`** (this task's exports only)

```ts
import { config } from "./config";
import { classify, type Category } from "./classify";
import { localHour, localDate, hourDecimal } from "./analytics";
import type { Observation } from "./types";

export type HoursMode = "riding" | "full";
export type Range = "day" | "week" | "month";

export interface BandPoint {
  i: number; time: string; low: number; high: number;
  range: [number, number]; category: Category; dayKey: string; isPrime: boolean;
}

const RANGE_DAYS: Record<Range, number> = { day: 1, week: 7, month: 30 };

export function ridingHoursFilter(obs: Observation[], mode: HoursMode): Observation[] {
  if (mode === "full") return obs;
  return obs.filter((o) => {
    const h = localHour(o.time);
    return h >= config.ridingStartHour && h <= config.ridingEndHour;
  });
}

export function sliceByRange(obs: Observation[], range: Range, nowMs: number): Observation[] {
  const cutoff = nowMs - RANGE_DAYS[range] * 864e5;
  return obs.filter((o) => Date.parse(o.time) >= cutoff);
}

export function bandPoints(obs: Observation[]): BandPoint[] {
  return [...obs]
    .sort((a, b) => (a.time < b.time ? -1 : 1))
    .map((o, i) => {
      const hd = hourDecimal(o.time);
      return {
        i, time: o.time, low: o.low, high: o.high,
        range: [o.low, o.high] as [number, number],
        category: classify(o.low, o.high),
        dayKey: localDate(o.time),
        isPrime: hd >= config.primeStartHour && hd <= config.primeEndHour,
      };
    });
}

export function dayBoundaries(points: BandPoint[]): number[] {
  const out: number[] = [];
  for (let k = 1; k < points.length; k++) {
    if (points[k].dayKey !== points[k - 1].dayKey) out.push(points[k].i);
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/chartData.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/chartData.ts web/src/chartData.test.ts
git commit -m "feat: chart data helpers (riding filter, range slice, band points)"
```

---

### Task 4: Prime ranges, month daily-bars, steadiness label

**Files:**
- Modify: `web/src/chartData.ts`, `web/src/chartData.test.ts`, `web/src/classify.ts`, `web/src/classify.test.ts`

**Interfaces:**
- Consumes: `BandPoint`, `HoursMode`, `ridingHoursFilter`, `classify`.
- Produces:
  - `export interface DailyBar { date: string; minLull: number; maxGust: number; category: Category; }`
  - `export function primeRanges(points: BandPoint[]): Array<[number, number]>` (start/end `i` of each contiguous `isPrime` run)
  - `export function dailyBars(obs: Observation[], mode: HoursMode): DailyBar[]` (group by `localDate` after `ridingHoursFilter(mode)`; `minLull=min(low)`, `maxGust=max(high)`, `category=classify(minLull, maxGust)`; sorted by date asc)
  - `classify.ts` → `export function steadiness(low: number, high: number): "steady" | "a bit gusty" | "gusty"` (spread ≤ `steadySpreadMax` → steady; ≤ `gustySpreadMax` → a bit gusty; else gusty)

- [ ] **Step 1: Write failing tests**

Append to `web/src/chartData.test.ts`:
```ts
import { primeRanges, dailyBars } from "./chartData";

describe("primeRanges", () => {
  it("finds contiguous prime runs", () => {
    const pts = bandPoints([
      o("2026-08-08T11:00:00-06:00"), o("2026-08-08T13:00:00-06:00"),
      o("2026-08-08T14:00:00-06:00"), o("2026-08-08T18:00:00-06:00"),
    ]);
    expect(primeRanges(pts)).toEqual([[1, 2]]); // 13:00 & 14:00 are prime; 11 & 18 are not
  });
});

describe("dailyBars", () => {
  it("aggregates per day to min lull / max gust", () => {
    const bars = dailyBars([
      o("2026-08-08T13:00:00-06:00", 14, 19), o("2026-08-08T15:00:00-06:00", 16, 24),
      o("2026-08-09T13:00:00-06:00", 8, 12),
    ], "riding");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({ date: "2026-08-08", minLull: 14, maxGust: 24 });
    expect(bars[1]).toMatchObject({ date: "2026-08-09", category: "light" });
  });
});
```

Append to `web/src/classify.test.ts`:
```ts
import { steadiness } from "./classify";
describe("steadiness", () => {
  it("steady when spread within steadyMax", () => expect(steadiness(16, 20)).toBe("steady"));
  it("a bit gusty in the middle band", () => expect(steadiness(12, 20)).toBe("a bit gusty"));
  it("gusty above gustyMax", () => expect(steadiness(8, 22)).toBe("gusty"));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/chartData.test.ts src/classify.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement — add to `web/src/chartData.ts`**

```ts
export interface DailyBar { date: string; minLull: number; maxGust: number; category: Category; }

export function primeRanges(points: BandPoint[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = -1;
  for (let k = 0; k < points.length; k++) {
    if (points[k].isPrime && start === -1) start = points[k].i;
    if (!points[k].isPrime && start !== -1) { out.push([start, points[k - 1].i]); start = -1; }
  }
  if (start !== -1) out.push([start, points[points.length - 1].i]);
  return out;
}

export function dailyBars(obs: Observation[], mode: HoursMode): DailyBar[] {
  const byDay = new Map<string, { min: number; max: number }>();
  for (const o of ridingHoursFilter(obs, mode)) {
    const d = localDate(o.time);
    const cur = byDay.get(d) ?? { min: Infinity, max: -Infinity };
    cur.min = Math.min(cur.min, o.low);
    cur.max = Math.max(cur.max, o.high);
    byDay.set(d, cur);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, v]) => ({ date, minLull: v.min, maxGust: v.max, category: classify(v.min, v.max) }));
}
```

- [ ] **Step 4: Implement — add to `web/src/classify.ts`**

```ts
export function steadiness(low: number, high: number): "steady" | "a bit gusty" | "gusty" {
  const spread = high - low;
  if (spread <= config.steadySpreadMax) return "steady";
  if (spread <= config.gustySpreadMax) return "a bit gusty";
  return "gusty";
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/chartData.test.ts src/classify.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/chartData.ts web/src/chartData.test.ts web/src/classify.ts web/src/classify.test.ts
git commit -m "feat: prime ranges, month daily-bars, steadiness label"
```

---

## Stage C — Components

> **Rendering note for Tasks 5–11:** the exact JSX/Recharts code below is a concrete, correct-by-intent reference. Because Recharts renders 0×0 in jsdom, component tests assert container classes, empty states, and text — not layout. After writing each component, run `npm run build` and (at Task 12) a dev run; if a Recharts prop needs adjustment to render the described visual, adjust the rendering while keeping the tested contract and the Field styling. Consult the frontend-design skill for styling quality; the palette and structure are fixed by the spec.

### Task 5: Verdict hero (Field)

**Files:**
- Rewrite: `web/src/components/Verdict.tsx`
- Modify: `web/src/components/Verdict.test.tsx`

**Interfaces:**
- Consumes: `classify`, `steadiness`, `rateDirection` (classify.ts), `CAT_LABEL`/`categoryColor` (theme.ts), `Observation`.
- Produces: `export function Verdict({ latest }: { latest: Observation | null }): JSX.Element` — status chip (dot + `CAT_LABEL[cat]` in `categoryColor[cat]`), big `low–high mph` (gust in accent), "LULL → GUST" label, one line `dir · steadiness (N mph spread) · <ideal|ok|off> direction`, "updated …". Null → "No data yet".

- [ ] **Step 1: Update the test** (`web/src/components/Verdict.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Verdict } from "./Verdict";

describe("Verdict", () => {
  it("shows category label, lull–gust, and steadiness", () => {
    render(<Verdict latest={{ time: "2026-08-08T14:44:00-06:00", tempF: 95, dir: "SW", low: 16, high: 20 }} />);
    expect(screen.getByText(/Good/)).toBeTruthy();
    expect(screen.getByText(/16–20 mph/)).toBeTruthy();
    expect(screen.getByText(/steady/)).toBeTruthy();
  });
  it("empty state", () => {
    render(<Verdict latest={null} />);
    expect(screen.getByText(/No data yet/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/Verdict.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `web/src/components/Verdict.tsx`**

```tsx
import { classify, steadiness, rateDirection } from "../classify";
import { CAT_LABEL, categoryColor } from "../theme";
import type { Observation } from "../types";

const DIR_NOTE = { ideal: "ideal direction", ok: "ok direction", off: "off direction" } as const;

export function Verdict({ latest }: { latest: Observation | null }) {
  if (!latest) return <section className="panel"><h1>No data yet</h1></section>;
  const cat = classify(latest.low, latest.high);
  const dir = rateDirection(latest.dir);
  const spread = latest.high - latest.low;
  return (
    <section className="panel verdict">
      <div className="verdict-head">
        <span className="chip" style={{ color: categoryColor[cat] }}>● {CAT_LABEL[cat]}</span>
        <span className="verdict-time">updated {new Date(latest.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      </div>
      <div className="verdict-num">
        <span className="lull">{latest.low}</span><span className="sep">–</span>
        <span className="gust" style={{ color: "var(--accent)" }}>{latest.high}</span>
        <span className="unit">mph</span>
      </div>
      <div className="verdict-sub">lull → gust</div>
      <div className="verdict-line">
        <b>{latest.dir}</b> · {steadiness(latest.low, latest.high)} ({spread} mph spread) · {DIR_NOTE[dir]}
      </div>
    </section>
  );
}
```

Add matching styles to `web/src/theme.css`:
```css
.verdict-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.chip { font-size: 12px; font-weight: 700; letter-spacing: .06em; }
.verdict-time { font-size: 11px; color: var(--faint); }
.verdict-num { display: flex; align-items: baseline; gap: 8px; }
.verdict-num .lull, .verdict-num .gust { font-size: 52px; font-weight: 700; letter-spacing: -.02em; line-height: 1; }
.verdict-num .sep { font-size: 26px; color: var(--dim); }
.verdict-num .unit { font-size: 15px; color: var(--faint); }
.verdict-sub { font-size: 10px; letter-spacing: .12em; color: var(--dim); text-transform: uppercase; margin: 6px 0 14px; }
.verdict-line { font-size: 13px; color: var(--muted); }
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/Verdict.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Verdict.tsx web/src/components/Verdict.test.tsx web/src/theme.css
git commit -m "feat: Field-style Verdict hero with lull-gust + steadiness"
```

---

### Task 6: BandChart (Day/Week lull–gust band)

**Files:**
- Create: `web/src/components/chart/BandChart.tsx`, `web/src/components/chart/BandChart.test.tsx`

**Interfaces:**
- Consumes: `BandPoint`, `dayBoundaries`, `primeRanges` (chartData), `config`, Recharts.
- Produces: `export function BandChart({ points, showDayLabels }: { points: BandPoint[]; showDayLabels: boolean }): JSX.Element` — renders a Recharts composed chart: good-zone `ReferenceArea` (`goodLowMph`–`goodHighMph`), prime `ReferenceArea`s from `primeRanges`, a range `Area` on `dataKey="range"` (fill accent @ ~0.16), gust `Line` on `high` (accent), lull `Line` on `low` (`--lull`), day-divider `ReferenceLine`s at `dayBoundaries` (with day labels when `showDayLabels`). Empty → `<p>No history yet</p>` inside `.band-chart`.

- [ ] **Step 1: Write the failing test** (`web/src/components/chart/BandChart.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BandChart } from "./BandChart";
import { bandPoints } from "../../chartData";

describe("BandChart", () => {
  it("empty state", () => {
    render(<BandChart points={[]} showDayLabels={false} />);
    expect(screen.getByText(/No history yet/i)).toBeTruthy();
  });
  it("renders a container with data", () => {
    const pts = bandPoints([{ time: "2026-08-08T13:00:00-06:00", tempF: 90, dir: "SW", low: 15, high: 20 }]);
    const { container } = render(<BandChart points={pts} showDayLabels={true} />);
    expect(container.querySelector(".band-chart")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/BandChart.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `web/src/components/chart/BandChart.tsx`**

```tsx
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ReferenceArea, ReferenceLine, CartesianGrid,
} from "recharts";
import { config } from "../../config";
import { dayBoundaries, primeRanges, type BandPoint } from "../../chartData";

export function BandChart({ points, showDayLabels }: { points: BandPoint[]; showDayLabels: boolean }) {
  if (points.length === 0) return <div className="band-chart"><p>No history yet</p></div>;
  const boundaries = dayBoundaries(points);
  const primes = primeRanges(points);
  const dayLabel = (i: number) =>
    new Date(points.find((p) => p.i === i)!.time).toLocaleDateString(undefined, { weekday: "short" });
  return (
    <div className="band-chart">
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={points} margin={{ top: 6, right: 6, bottom: 2, left: -18 }}>
          <CartesianGrid stroke="#16213a" vertical={false} />
          <ReferenceArea y1={config.goodLowMph} y2={config.goodHighMph} fill="#22d3ee" fillOpacity={0.07} />
          {primes.map(([a, b], k) => (
            <ReferenceArea key={k} x1={a} x2={b} fill="#0ea5b7" fillOpacity={0.05} />
          ))}
          {boundaries.map((i) => (
            <ReferenceLine key={i} x={i} stroke="#1e293b"
              label={showDayLabels ? { value: dayLabel(i), position: "insideTop", fill: "#64748b", fontSize: 9 } : undefined} />
          ))}
          <XAxis dataKey="i" hide />
          <YAxis width={34} tick={{ fill: "#64748b", fontSize: 10 }} unit=" " domain={[0, "dataMax + 4"]} />
          <Tooltip contentStyle={{ background: "#0e1729", border: "1px solid #1e293b", borderRadius: 8, color: "#e6edf6" }}
            labelFormatter={(_, p) => (p && p[0] ? new Date((p[0].payload as BandPoint).time).toLocaleString() : "")}
            formatter={(v, name) => [`${v} mph`, name === "high" ? "gust" : name === "low" ? "lull" : name]} />
          <Area dataKey="range" stroke="none" fill="#22d3ee" fillOpacity={0.16} isAnimationActive={false} />
          <Line dataKey="high" dot={false} stroke="#22d3ee" strokeWidth={1.8} isAnimationActive={false} />
          <Line dataKey="low" dot={false} stroke="#0e7490" strokeWidth={1.4} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/BandChart.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/chart/BandChart.tsx web/src/components/chart/BandChart.test.tsx
git commit -m "feat: lull-gust BandChart for Day/Week views"
```

---

### Task 7: MonthBars (one lull–gust bar per day)

**Files:**
- Create: `web/src/components/chart/MonthBars.tsx`, `web/src/components/chart/MonthBars.test.tsx`

**Interfaces:**
- Consumes: `DailyBar` (chartData), `categoryColor` (theme), Recharts.
- Produces: `export function MonthBars({ bars }: { bars: DailyBar[] }): JSX.Element` — a Recharts `BarChart` where each day is a floating bar from `minLull` to `maxGust` (use a datum `{ date, base: minLull, span: maxGust-minLull, ... }` with a transparent base bar + a colored span bar via `categoryColor[category]`), good-zone `ReferenceArea`. Empty → `<p>No history yet</p>` in `.month-bars`.

- [ ] **Step 1: Write the failing test** (`web/src/components/chart/MonthBars.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MonthBars } from "./MonthBars";

describe("MonthBars", () => {
  it("empty state", () => {
    render(<MonthBars bars={[]} />);
    expect(screen.getByText(/No history yet/i)).toBeTruthy();
  });
  it("renders with data", () => {
    const { container } = render(<MonthBars bars={[{ date: "2026-08-08", minLull: 14, maxGust: 24, category: "gusty" }]} />);
    expect(container.querySelector(".month-bars")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/MonthBars.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `web/src/components/chart/MonthBars.tsx`**

```tsx
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceArea, Cell, CartesianGrid } from "recharts";
import { config } from "../../config";
import { categoryColor } from "../../theme";
import type { DailyBar } from "../../chartData";

export function MonthBars({ bars }: { bars: DailyBar[] }) {
  if (bars.length === 0) return <div className="month-bars"><p>No history yet</p></div>;
  const data = bars.map((b) => ({ ...b, base: b.minLull, span: b.maxGust - b.minLull }));
  return (
    <div className="month-bars">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 6, right: 6, bottom: 2, left: -18 }}>
          <CartesianGrid stroke="#16213a" vertical={false} />
          <ReferenceArea y1={config.goodLowMph} y2={config.goodHighMph} fill="#22d3ee" fillOpacity={0.07} />
          <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} tickFormatter={(d) => d.slice(5)} />
          <YAxis width={34} tick={{ fill: "#64748b", fontSize: 10 }} domain={[0, "dataMax + 4"]} />
          <Tooltip contentStyle={{ background: "#0e1729", border: "1px solid #1e293b", borderRadius: 8, color: "#e6edf6" }}
            formatter={(_, __, item) => {
              const p = item.payload as DailyBar & { span: number };
              return [`${p.minLull}–${p.maxGust} mph`, "lull–gust"];
            }} />
          <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="span" stackId="a" radius={[3, 3, 3, 3]} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={categoryColor[d.category]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/MonthBars.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/chart/MonthBars.tsx web/src/components/chart/MonthBars.test.tsx
git commit -m "feat: MonthBars per-day lull-gust chart"
```

---

### Task 8: HistoryChart (controls + state + compose)

**Files:**
- Create: `web/src/components/chart/HistoryChart.tsx`, `web/src/components/chart/HistoryChart.test.tsx`
- Delete: `web/src/components/HistoryChart.tsx`, `web/src/components/HistoryChart.test.tsx`

**Interfaces:**
- Consumes: `sliceByRange`, `ridingHoursFilter`, `bandPoints`, `dailyBars`, `Range`, `HoursMode` (chartData); `BandChart`, `MonthBars`.
- Produces: `export function HistoryChart({ observations, nowMs }: { observations: Observation[]; nowMs?: number }): JSX.Element` — holds `range` state (default `"week"`) and `hours` state (default `"riding"`); renders range chips (Day/Week/Month) and a Riding/Full toggle; for day/week → `BandChart` (points from `bandPoints(ridingHoursFilter(sliceByRange(...)))`, `showDayLabels = range==="week"`); for month → `MonthBars` (`dailyBars(sliceByRange(...,"month"), hours)`). `nowMs` defaults to `Date.now()` (injectable for tests).

- [ ] **Step 1: Write the failing test** (`web/src/components/chart/HistoryChart.test.tsx`)

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HistoryChart } from "./HistoryChart";
import type { Observation } from "../../types";

const obs: Observation[] = [{ time: "2026-08-08T13:00:00-06:00", tempF: 90, dir: "SW", low: 15, high: 20 }];
const now = Date.parse("2026-08-08T18:00:00-06:00");

describe("HistoryChart", () => {
  it("defaults to Week + Riding and shows controls", () => {
    render(<HistoryChart observations={obs} nowMs={now} />);
    expect(screen.getByRole("button", { name: "Week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Riding" })).toBeTruthy();
  });
  it("switching to Month renders the month view", () => {
    const { container } = render(<HistoryChart observations={obs} nowMs={now} />);
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(container.querySelector(".month-bars")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/HistoryChart.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `web/src/components/chart/HistoryChart.tsx`**

```tsx
import { useState } from "react";
import { sliceByRange, ridingHoursFilter, bandPoints, dailyBars, type Range, type HoursMode } from "../../chartData";
import type { Observation } from "../../types";
import { BandChart } from "./BandChart";
import { MonthBars } from "./MonthBars";

const RANGES: Range[] = ["day", "week", "month"];
const LABEL: Record<Range, string> = { day: "Day", week: "Week", month: "Month" };

export function HistoryChart({ observations, nowMs = Date.now() }: { observations: Observation[]; nowMs?: number }) {
  const [range, setRange] = useState<Range>("week");
  const [hours, setHours] = useState<HoursMode>("riding");
  const sliced = sliceByRange(observations, range, nowMs);
  return (
    <section className="panel history">
      <div className="history-head">
        <span className="section-title">History</span>
        <div className="chips">
          {RANGES.map((r) => (
            <button key={r} className={`chip-btn${range === r ? " on" : ""}`} onClick={() => setRange(r)}>{LABEL[r]}</button>
          ))}
        </div>
      </div>
      <div className="hours-toggle">
        {(["riding", "full"] as HoursMode[]).map((h) => (
          <button key={h} className={`seg${hours === h ? " on" : ""}`} onClick={() => setHours(h)}>
            {h === "riding" ? "Riding" : "Full"}
          </button>
        ))}
      </div>
      {range === "month"
        ? <MonthBars bars={dailyBars(sliced, hours)} />
        : <BandChart points={bandPoints(ridingHoursFilter(sliced, hours))} showDayLabels={range === "week"} />}
    </section>
  );
}
```

Add to `web/src/theme.css`:
```css
.history-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.chips, .hours-toggle { display: flex; gap: 6px; }
.hours-toggle { justify-content: flex-end; margin-bottom: 8px; }
.chip-btn, .seg { font: inherit; font-size: 11px; cursor: pointer; border: 1px solid var(--border); background: var(--border); color: var(--muted); padding: 3px 9px; border-radius: 6px; }
.chip-btn.on, .seg.on { background: var(--accent); color: var(--bg); border-color: var(--accent); font-weight: 600; }
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/HistoryChart.test.tsx`
Expected: PASS.

- [ ] **Step 5: Delete the old flat HistoryChart**

```bash
git rm web/src/components/HistoryChart.tsx web/src/components/HistoryChart.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add web/src/components/chart/HistoryChart.tsx web/src/components/chart/HistoryChart.test.tsx web/src/theme.css
git commit -m "feat: HistoryChart with Day/Week/Month + Riding/Full controls"
```

---

### Task 9: RecentReadings (+ CSV) and remove DataTable

**Files:**
- Create: `web/src/components/RecentReadings.tsx`, `web/src/components/RecentReadings.test.tsx`
- Delete: `web/src/components/DataTable.tsx`, `web/src/components/DataTable.test.tsx`
- Keep: `web/src/csv.ts`, `web/src/csv.test.ts` (reused)

**Interfaces:**
- Consumes: `classify` + `categoryColor`, `toCsv` (csv.ts), `Observation`.
- Produces: `export function RecentReadings({ observations }: { observations: Observation[] }): JSX.Element` — newest-first, shows up to 8 rows `time · dir · low–high · ·spread · category dot`; a "Download CSV" button that exports ALL observations via `toCsv`. Empty → "No readings yet".

- [ ] **Step 1: Write the failing test** (`web/src/components/RecentReadings.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RecentReadings } from "./RecentReadings";

describe("RecentReadings", () => {
  it("empty state", () => {
    render(<RecentReadings observations={[]} />);
    expect(screen.getByText(/No readings yet/i)).toBeTruthy();
  });
  it("lists newest first with a CSV button", () => {
    render(<RecentReadings observations={[
      { time: "2026-08-08T14:40:00-06:00", tempF: 90, dir: "SW", low: 12, high: 20 },
      { time: "2026-08-08T14:44:00-06:00", tempF: 90, dir: "SW", low: 15, high: 20 },
    ]} />);
    const rows = screen.getAllByText(/15–20|12–20/);
    expect(rows[0].textContent).toContain("15–20"); // newest first
    expect(screen.getByRole("button", { name: /CSV/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/RecentReadings.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `web/src/components/RecentReadings.tsx`**

```tsx
import { classify } from "../classify";
import { categoryColor } from "../theme";
import { toCsv } from "../csv";
import type { Observation } from "../types";

export function RecentReadings({ observations }: { observations: Observation[] }) {
  if (observations.length === 0) return <section className="panel"><span className="section-title">Recent readings</span><p>No readings yet</p></section>;
  const sorted = [...observations].sort((a, b) => (a.time < b.time ? 1 : -1));
  const download = () => {
    const blob = new Blob([toCsv(sorted)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "barbed-wire-readings.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="panel recent">
      <div className="recent-head">
        <span className="section-title">Recent readings</span>
        <button className="csv-btn" onClick={download}>⬇ CSV</button>
      </div>
      <div className="recent-rows">
        {sorted.slice(0, 8).map((o, i) => {
          const cat = classify(o.low, o.high);
          return (
            <div className="recent-row" key={i}>
              <span className="t">{new Date(o.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              <span className="d">{o.dir}</span>
              <span className="v"><b>{o.low}–{o.high}</b> <span className="sp">·{o.high - o.low}</span></span>
              <span className="dot" style={{ color: categoryColor[cat] }}>●</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

Add to `web/src/theme.css`:
```css
.recent-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.csv-btn { font: inherit; font-size: 11px; color: var(--accent); background: none; border: none; cursor: pointer; }
.recent-row { display: grid; grid-template-columns: 56px 34px 1fr auto; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--hairline); font-size: 13px; }
.recent-row:last-child { border-bottom: none; }
.recent-row .t { color: var(--faint); } .recent-row .sp { color: var(--dim); }
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/RecentReadings.test.tsx`
Expected: PASS.

- [ ] **Step 5: Delete DataTable**

```bash
git rm web/src/components/DataTable.tsx web/src/components/DataTable.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add web/src/components/RecentReadings.tsx web/src/components/RecentReadings.test.tsx web/src/theme.css
git commit -m "feat: RecentReadings section with CSV; remove DataTable"
```

---

### Task 10: HourPattern restyle (riding hours, category colors)

**Files:**
- Modify: `web/src/components/HourPattern.tsx`, `web/src/components/HourPattern.test.tsx`

**Interfaces:**
- Consumes: `hourPattern` (analytics), `ridingHoursFilter` (chartData), `categoryColor` + `classify`, Recharts.
- Produces: `HourPattern({ observations })` unchanged signature; now filters to riding hours before `hourPattern`, colors each bar by `classify` of that hour's average band, Field styling. Empty → "Not enough data yet" inside `.hour-pattern`.

- [ ] **Step 1: Update the test** (`web/src/components/HourPattern.test.tsx`) — keep the two existing cases (empty + `.hour-pattern` with data); no new assertions required beyond container/empty. Ensure it still imports/renders.

- [ ] **Step 2: Run to verify current state**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/HourPattern.test.tsx`
Expected: PASS currently (pre-restyle) — this is a refactor; keep it green.

- [ ] **Step 3: Implement `web/src/components/HourPattern.tsx`**

```tsx
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { hourPattern } from "../analytics";
import { ridingHoursFilter } from "../chartData";
import { classify } from "../classify";
import { categoryColor } from "../theme";
import type { Observation } from "../types";

export function HourPattern({ observations }: { observations: Observation[] }) {
  const data = hourPattern(ridingHoursFilter(observations, "riding"));
  if (data.length === 0) return <section className="panel"><span className="section-title">When it's usually good</span><p>Not enough data yet</p></section>;
  return (
    <section className="panel hour-pattern">
      <span className="section-title">When it's usually good</span>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 10, right: 6, bottom: 2, left: -18 }}>
          <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(h) => `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`} />
          <YAxis width={34} tick={{ fill: "#64748b", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "#0e1729", border: "1px solid #1e293b", borderRadius: 8, color: "#e6edf6" }}
            formatter={(v: number) => [`${v.toFixed(1)} mph avg`, ""]} labelFormatter={(h) => `${h}:00`} />
          <Bar dataKey="avgMid" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={categoryColor[classify(d.avgMid - 2, d.avgMid + 2)]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/HourPattern.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/HourPattern.tsx web/src/components/HourPattern.test.tsx
git commit -m "feat: HourPattern restyle (riding hours, category colors)"
```

---

### Task 11: Scoreboard + ForecastVsActual restyle

**Files:**
- Modify: `web/src/components/ModelScoreboard.tsx`, `web/src/components/ForecastVsActual.tsx`
- Keep tests: `web/src/components/ModelScoreboard.test.tsx`, `web/src/components/ForecastVsActual.test.tsx` (behavior unchanged; must stay green)

**Interfaces:** unchanged signatures (`{ observations, forecasts }`). Presentation only: wrap in `.panel`, use `.section-title`, Field colors, keep the `miss` class (styled via `--strong`/amber). No logic changes.

- [ ] **Step 1: Run existing tests to confirm green baseline**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/ModelScoreboard.test.tsx src/components/ForecastVsActual.test.tsx`
Expected: PASS (pre-restyle).

- [ ] **Step 2: Restyle `ModelScoreboard.tsx`** — keep the exact data/logic; change the wrapper and rows:

```tsx
import { scoreboard } from "../analytics";
import type { Observation, Forecast } from "../types";

export function ModelScoreboard({ observations, forecasts }: { observations: Observation[]; forecasts: Forecast[] }) {
  const rows = scoreboard(observations, forecasts);
  if (rows.length === 0) return <section className="panel model-scoreboard"><span className="section-title">Which forecast to trust</span><p>No overlapping days yet</p></section>;
  return (
    <section className="panel model-scoreboard">
      <span className="section-title">Which forecast to trust</span>
      <div className="board">
        {rows.map((r, i) => (
          <div className="board-row" key={r.key}>
            <span>{r.key}</span>
            <span style={{ color: i === 0 ? "var(--accent)" : "var(--muted)" }}>±{r.mae.toFixed(1)} mph{i === 0 ? " · most accurate" : ""}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

Add to `theme.css`:
```css
.board-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--hairline); font-size: 12px; }
.board-row:last-child { border-bottom: none; }
```

- [ ] **Step 3: Restyle `ForecastVsActual.tsx`** — keep the exact logic (union of keys scoped to rendered `days`, `miss` when `>=8`); change only the wrapper/classes:

Wrap the returned markup in `<section className="panel forecast-actual">` with a `<span className="section-title">Forecast vs actual</span>`, keep the existing table/rows and the `td.miss` class. Update the empty state to the panel style. Add to `theme.css`:
```css
.forecast-actual table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 8px; }
.forecast-actual th, .forecast-actual td { border-bottom: 1px solid var(--hairline); padding: 4px 6px; text-align: left; color: var(--muted); }
.forecast-actual td.miss { color: var(--gusty); font-weight: 700; }
```

- [ ] **Step 4: Run to verify tests still pass**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/ModelScoreboard.test.tsx src/components/ForecastVsActual.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ModelScoreboard.tsx web/src/components/ForecastVsActual.tsx web/src/theme.css
git commit -m "feat: Field restyle for scoreboard and forecast-vs-actual"
```

---

### Task 12: App assembly, layout, and final verification

**Files:**
- Rewrite: `web/src/App.tsx`
- Test: `web/src/App.test.tsx` (new smoke test)

**Interfaces:**
- Consumes: `loadData`, all components (note new import paths: `HistoryChart` from `./components/chart/HistoryChart`).
- Produces: assembled dashboard in the section order: header → Verdict → HistoryChart → RecentReadings → HourPattern → ForecastVsActual → ModelScoreboard.

- [ ] **Step 1: Write the failing smoke test** (`web/src/App.test.tsx`)

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the header after loading", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => "" })) as unknown as typeof fetch);
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Barbed Wire Beach/i)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/App.test.tsx`
Expected: FAIL (App not yet rewritten / import paths).

- [ ] **Step 3: Rewrite `web/src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import { loadData } from "./dataLoader";
import type { Observation, Forecast } from "./types";
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
          <Verdict latest={latest} />
          <HistoryChart observations={obs} />
          <RecentReadings observations={obs} />
          <HourPattern observations={obs} />
          <ForecastVsActual observations={obs} forecasts={fc} />
          <ModelScoreboard observations={obs} forecasts={fc} />
        </>
      )}
    </main>
  );
}
```

Add to `theme.css`:
```css
.app-head { display: flex; justify-content: space-between; align-items: center; padding: 2px; }
.app-title { font-size: 16px; font-weight: 700; letter-spacing: -.01em; }
.app-sub { font-size: 11px; color: var(--faint); margin-top: 1px; }
.live { font-size: 11px; color: var(--accent); }
```

- [ ] **Step 4: Run the FULL web suite + build**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npm test && npm run build`
Expected: ALL tests pass; build succeeds.

- [ ] **Step 5: Dev-run visual check (manual)**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npm run dev` (then open the local URL). Confirm: dark Field theme, Space Grotesk, quiet verdict, band chart with working Day/Week/Month + Riding/Full toggles, recent readings, colored hour bars, scoreboard. Stop the dev server when done. If any Recharts rendering needs adjustment (band fill, month floating bars, axis), fix it here while keeping tests green.

- [ ] **Step 6: Commit**

```bash
git add web/src/App.tsx web/src/App.test.tsx web/src/theme.css
git commit -m "feat: assemble redesigned dashboard (Field layout)"
```

---

## Self-Review Notes (author)

- **Spec coverage:** theme/fonts/dead-CSS (T1), config riding-window + analytics (T2, spec §6), band-data + month + steadiness (T3–T4, §4/§5.2), Verdict hero (T5, §5.1), band chart + Day/Week/Month + Riding/Full + prime stripe (T6/T7/T8, §5.2), Recent readings + CSV, DataTable removed (T9, §5.3), HourPattern riding hours (T10, §5.4), scoreboard + vs-actual restyle (T11, §5.5), layout/order (T12, §5.6). Cleanup (§7) in T1/T8/T9. Testing approach per §8. Phase II (§9) excluded.
- **Type consistency:** `Category` from classify.ts used by theme/chartData; `BandPoint`/`DailyBar`/`Range`/`HoursMode` defined in chartData (T3/T4) and consumed unchanged in T6–T8; `HistoryChart` import path moves to `components/chart/` (old deleted in T8, App updated in T12).
- **Rendering caveat** is explicit before Task 5: Recharts specifics may be adjusted during the build to achieve the described visual, tests + palette held fixed. This is verification-driven, not a placeholder.
