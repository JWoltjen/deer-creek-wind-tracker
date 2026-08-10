# Chart Polish + Time-in-Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hourly x-axis ticks (Day) + day/marker ticks (Week), a fives y-axis, a toggleable "time in your window" chip that dims out-of-window band segments, and fix mobile kite entry.

**Architecture:** Pure helpers in `chartData.ts`/`format.ts` (tick arrays, in-window time) drive small edits to the chart components; a persisted chip in `HistoryChart` toggles the emphasis. Presentation only — no collector/data/model change.

**Tech Stack:** React 18 + Vite + TypeScript, Vitest + React Testing Library, Recharts.

## Global Constraints

- **Presentation only.** No collector, NDJSON schema, `Observation`/`Forecast`, or calibration-model change.
- **X-axis:** Day (`showDayLabels === false`) = a tick at **every clock hour**; Week (`showDayLabels === true`) = keep day-boundary labels + a tick at each of `config.weekMarkerHours` (default `[12, 15]`) per day. Labels via `formatHourShort` (12-hour, e.g. `1p`).
- **Y-axis:** explicit ticks at multiples of **5** from 0 to the next multiple of 5 ≥ data max (`fiveTicks`). Applies to BandChart and MonthBars.
- **In-window:** chip in the History header, **off by default**, persisted `dc.chart.inWindow`. "In window" = a reading's mid `(low+high)/2` within `[goodLowMph, goodHighMph]` (from `useThresholds()`). **Time** = sum over **riding-hour** readings of `min(gap-to-next-reading, 5 min)`; formatted `Hh Mm`. On → dim out-of-window band segments (accent in-window, `#334155` out).
- **Mobile kite entry:** kite input inside a `<form onSubmit>` + a visible "＋" add button; kite-remove buttons must be `type="button"` so they don't submit.
- **Field theme** unchanged; Space Grotesk; dark. **TDD**; charts render 0×0 in jsdom so tests assert structure/state, not pixels; visual dev-run before merge.
- **Node/npm not on PATH:** prefix node/npm/npx with `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH"`.

---

## File Structure

```
web/src/
  config.ts                       # MODIFY — add weekMarkerHours: [12, 15]
  format.ts                       # MODIFY — add formatDuration(mins)
  chartData.ts                    # MODIFY — add fiveTicks, hourTicks (+AxisTick), timeInWindow
  components/chart/BandChart.tsx   # MODIFY — hour/five axes; inWindow dim (new prop)
  components/chart/MonthBars.tsx   # MODIFY — five-tick y-axis
  components/chart/HistoryChart.tsx# MODIFY — persisted in-window chip + stat; pass inWindow
  components/CalibrationPanel.tsx  # MODIFY — form + "＋" button; remove-btn type=button
  theme.css                       # MODIFY — chip + add-button styles
```

---

## Task 1: Axis-tick helpers (`fiveTicks`, `hourTicks`) + config

**Files:** Modify `web/src/chartData.ts`, `web/src/chartData.test.ts`, `web/src/config.ts`

**Interfaces:**
- Produces: `export function fiveTicks(maxMph: number): number[]` — `27 → [0,5,10,15,20,25,30]`, `0 → [0,5]`.
- Produces: `export interface AxisTick { i: number; label: string; }`
- Produces: `export function hourTicks(points: BandPoint[], showDayLabels: boolean, markerHours: number[]): AxisTick[]` — Day (`showDayLabels=false`): first point-index of each new clock hour, label `formatHourShort(hour)`. Week (`true`): first point-index of each `markerHours` occurrence per day.
- Produces (config): `weekMarkerHours: [12, 15]`.

- [ ] **Step 1: Add config key** — in `web/src/config.ts`, add after `primeEndHour`:
```ts
  weekMarkerHours: [12, 15],
```

- [ ] **Step 2: Write the failing test** (append to `web/src/chartData.test.ts`)

```ts
import { fiveTicks, hourTicks } from "./chartData";

describe("fiveTicks", () => {
  it("rounds up to a multiple of 5", () => {
    expect(fiveTicks(27)).toEqual([0, 5, 10, 15, 20, 25, 30]);
    expect(fiveTicks(20)).toEqual([0, 5, 10, 15, 20]);
    expect(fiveTicks(0)).toEqual([0, 5]);
  });
});

describe("hourTicks", () => {
  it("Day: one tick per clock hour", () => {
    const pts = bandPoints([
      o("2026-08-08T13:00:00-06:00"), o("2026-08-08T13:30:00-06:00"),
      o("2026-08-08T14:00:00-06:00"),
    ]);
    expect(hourTicks(pts, false, [12, 15])).toEqual([
      { i: 0, label: "1p" }, { i: 2, label: "2p" },
    ]);
  });
  it("Week: marker hours per day", () => {
    const pts = bandPoints([
      o("2026-08-08T12:00:00-06:00"), o("2026-08-08T13:00:00-06:00"),
      o("2026-08-08T15:00:00-06:00"), o("2026-08-09T12:00:00-06:00"),
    ]);
    expect(hourTicks(pts, true, [12, 15])).toEqual([
      { i: 0, label: "12p" }, { i: 2, label: "3p" }, { i: 3, label: "12p" },
    ]);
  });
});
```
(`o` and `bandPoints` are already imported at the top of `chartData.test.ts`.)

- [ ] **Step 3: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/chartData.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement** — add to `web/src/chartData.ts` (reuse the existing `localHour` import from `./analytics` and add `formatHourShort` from `./format`):

```ts
import { formatHourShort } from "./format";

export function fiveTicks(maxMph: number): number[] {
  const top = Math.ceil(Math.max(5, maxMph) / 5) * 5;
  const out: number[] = [];
  for (let v = 0; v <= top; v += 5) out.push(v);
  return out;
}

export interface AxisTick { i: number; label: string; }

export function hourTicks(points: BandPoint[], showDayLabels: boolean, markerHours: number[]): AxisTick[] {
  const out: AxisTick[] = [];
  let lastHour = -1, lastKey = "";
  for (const p of points) {
    const h = localHour(p.time);
    if (showDayLabels) {
      const key = `${p.dayKey}|${h}`;
      if (markerHours.includes(h) && key !== lastKey) {
        out.push({ i: p.i, label: formatHourShort(h) });
        lastKey = key;
      }
    } else if (h !== lastHour) {
      out.push({ i: p.i, label: formatHourShort(h) });
      lastHour = h;
    }
  }
  return out;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/chartData.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/chartData.ts web/src/chartData.test.ts web/src/config.ts
git commit -m "feat: fiveTicks + hourTicks axis helpers; weekMarkerHours config"
```

---

## Task 2: `timeInWindow` + `formatDuration`

**Files:** Modify `web/src/chartData.ts`, `web/src/chartData.test.ts`, `web/src/format.ts`, `web/src/format.test.ts`

**Interfaces:**
- Produces: `format.ts` → `export function formatDuration(mins: number): string` (`160→"2h 40m"`, `120→"2h"`, `40→"40m"`, `0→"0m"`).
- Produces: `chartData.ts` → `export function timeInWindow(obs: Observation[], t: Thresholds, ridingStart: number, ridingEnd: number, capMin?: number): number` — minutes; over riding-hour readings (`localHour` in `[ridingStart, ridingEnd]` inclusive) whose mid is within `[t.goodLowMph, t.goodHighMph]`, sum `min(gap-to-next, capMin=5)`; rounded.

- [ ] **Step 1: Write failing tests**

Append to `web/src/format.test.ts`:
```ts
import { formatDuration } from "./format";
describe("formatDuration", () => {
  it("formats hours+minutes", () => {
    expect(formatDuration(160)).toBe("2h 40m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(40)).toBe("40m");
    expect(formatDuration(0)).toBe("0m");
  });
});
```

Append to `web/src/chartData.test.ts`:
```ts
import { timeInWindow } from "./chartData";
import { configThresholds } from "./classify";

describe("timeInWindow", () => {
  const t = configThresholds; // good 15–26
  it("sums in-window riding readings, caps gaps at 5 min", () => {
    const data = [
      o("2026-08-08T13:00:00-06:00", 16, 20), // in, 2 min to next
      o("2026-08-08T13:02:00-06:00", 16, 21), // in, 30 min gap → capped 5
      o("2026-08-08T13:32:00-06:00", 8, 12),  // out (too light)
      o("2026-08-08T20:00:00-06:00", 16, 20), // out of riding hours (>19)
    ];
    // in-window riding readings: #0 (2) + #1 (min(30,5)=5) = 7
    expect(timeInWindow(data, t, 11, 19, 5)).toBe(7);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/format.test.ts src/chartData.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add to `web/src/format.ts`:
```ts
export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
```

Add to `web/src/chartData.ts`:
```ts
export function timeInWindow(obs: Observation[], t: Thresholds, ridingStart: number, ridingEnd: number, capMin = 5): number {
  const sorted = [...obs].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  let mins = 0;
  for (let k = 0; k < sorted.length; k++) {
    const oo = sorted[k];
    const h = localHour(oo.time);
    if (h < ridingStart || h > ridingEnd) continue;
    const mid = (oo.low + oo.high) / 2;
    if (mid < t.goodLowMph || mid > t.goodHighMph) continue;
    let gap = capMin;
    if (k + 1 < sorted.length) {
      const g = (Date.parse(sorted[k + 1].time) - Date.parse(oo.time)) / 60000;
      gap = Math.min(capMin, Math.max(0, g));
    }
    mins += gap;
  }
  return Math.round(mins);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/format.test.ts src/chartData.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/format.ts web/src/format.test.ts web/src/chartData.ts web/src/chartData.test.ts
git commit -m "feat: timeInWindow + formatDuration"
```

---

## Task 3: BandChart axes (hour ticks + fives)

**Files:** Modify `web/src/components/chart/BandChart.tsx` (tests: `BandChart.test.tsx` stay green)

**Interfaces:** Consumes `hourTicks`, `fiveTicks`, `config.weekMarkerHours`.

- [ ] **Step 1: Confirm green baseline**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/BandChart.test.tsx`
Expected: PASS.

- [ ] **Step 2: Edit `BandChart.tsx`** — add imports `import { config } from "../../config";` and extend the chartData import to include `hourTicks, fiveTicks`. Inside the component (after `const t = useThresholds();`), compute:
```tsx
  const xTicks = hourTicks(points, showDayLabels, config.weekMarkerHours);
  const yTicks = fiveTicks(Math.max(0, ...points.map((p) => p.high)));
```
Replace the `<XAxis … />` block with (axis always shown; explicit hour ticks):
```tsx
          <XAxis
            dataKey="i" type="number" domain={["dataMin", "dataMax"]}
            ticks={xTicks.map((x) => x.i)} interval={0} tickMargin={4}
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(i) => xTicks.find((x) => x.i === i)?.label ?? ""}
          />
```
Replace the `<YAxis … />` with:
```tsx
          <YAxis width={34} ticks={yTicks} domain={[0, yTicks[yTicks.length - 1]]} tick={{ fill: "#64748b", fontSize: 10 }} />
```
(The day-boundary `ReferenceLine` labels for Week stay as they are.)

- [ ] **Step 3: Run tests + build**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/BandChart.test.tsx && npm run build`
Expected: PASS + build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/chart/BandChart.tsx
git commit -m "feat: BandChart hour ticks (Day/Week) + fives y-axis"
```

---

## Task 4: BandChart in-window dimming

**Files:** Modify `web/src/components/chart/BandChart.tsx`, `web/src/components/chart/BandChart.test.tsx`

**Interfaces:** Produces new OPTIONAL prop `inWindow?: boolean` (default `false`) on `BandChart` — so HistoryChart, which doesn't pass it yet, keeps building. When true, the gust/lull lines split into in-window (accent) and out-of-window (`#334155`) segments; when false/absent, unchanged.

- [ ] **Step 1: Add the failing test** to `BandChart.test.tsx`

```tsx
it("renders in-window split lines when inWindow is on", () => {
  const pts = bandPoints([
    { time: "2026-08-08T13:00:00-06:00", tempF: 90, dir: "SW", low: 16, high: 20 },
    { time: "2026-08-08T13:02:00-06:00", tempF: 90, dir: "SW", low: 8, high: 12 },
  ]);
  const { container } = render(<BandChart points={pts} showDayLabels={false} inWindow={true} />);
  expect(container.querySelector(".band-chart")).toBeTruthy();
});
```
(The two existing BandChart tests need no change — `inWindow` is optional and defaults to false.)

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/BandChart.test.tsx`
Expected: FAIL — the test passes `inWindow={true}`, which doesn't exist on BandChart's props yet, so the test file fails to type-check/run (unknown-prop error). (Honest note: jsdom can't assert the split lines visually; this test's job is to lock the prop + a rendering container, and the actual dim behavior is verified in the Task 7 dev-run.)

- [ ] **Step 3: Implement** — change the signature to `{ points, showDayLabels, inWindow = false }: { points: BandPoint[]; showDayLabels: boolean; inWindow?: boolean }`. After computing `t`, derive split data:
```tsx
  const data = points.map((p) => {
    const inW = (p.low + p.high) / 2 >= t.goodLowMph && (p.low + p.high) / 2 <= t.goodHighMph;
    return { ...p, highIn: inW ? p.high : null, highOut: inW ? null : p.high, lowIn: inW ? p.low : null, lowOut: inW ? null : p.low };
  });
```
Use `data` as the `<ComposedChart data={...}>` source (it is a superset of `points`, so `dataKey="i"/"range"/"high"/"low"` still resolve). Replace the two `<Line dataKey="high" …>` / `<Line dataKey="low" …>` with a conditional:
```tsx
          {inWindow ? (
            <>
              <Line dataKey="highOut" dot={false} stroke="#334155" strokeWidth={1.8} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="lowOut" dot={false} stroke="#334155" strokeWidth={1.4} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="highIn" dot={false} stroke="#22d3ee" strokeWidth={1.8} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="lowIn" dot={false} stroke="#0e7490" strokeWidth={1.4} isAnimationActive={false} connectNulls={false} />
            </>
          ) : (
            <>
              <Line dataKey="high" dot={false} stroke="#22d3ee" strokeWidth={1.8} isAnimationActive={false} />
              <Line dataKey="low" dot={false} stroke="#0e7490" strokeWidth={1.4} isAnimationActive={false} />
            </>
          )}
```
(The `Area dataKey="range"` fill stays above these, unchanged.)

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/BandChart.test.tsx && npm run build`
Expected: PASS + build succeeds. (Note: minor 1-point gaps can appear at in/out transitions — acceptable; confirm in the Task 7 dev-run.)

- [ ] **Step 5: Commit**

```bash
git add web/src/components/chart/BandChart.tsx web/src/components/chart/BandChart.test.tsx
git commit -m "feat: BandChart dim out-of-window segments when inWindow on"
```

---

## Task 5: MonthBars fives y-axis

**Files:** Modify `web/src/components/chart/MonthBars.tsx` (test stays green)

- [ ] **Step 1: Confirm baseline**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/MonthBars.test.tsx`
Expected: PASS.

- [ ] **Step 2: Edit `MonthBars.tsx`** — extend the chartData import to include `fiveTicks`; inside the component compute `const yTicks = fiveTicks(Math.max(0, ...bars.map((b) => b.maxGust)));` and replace the `<YAxis …>` with:
```tsx
          <YAxis width={34} ticks={yTicks} domain={[0, yTicks[yTicks.length - 1]]} tick={{ fill: "#64748b", fontSize: 10 }} />
```

- [ ] **Step 3: Run tests + build**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/MonthBars.test.tsx && npm run build`
Expected: PASS + build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/chart/MonthBars.tsx
git commit -m "feat: MonthBars fives y-axis"
```

---

## Task 6: HistoryChart in-window chip + stat

**Files:** Modify `web/src/components/chart/HistoryChart.tsx`, `web/src/components/chart/HistoryChart.test.tsx`, `web/src/theme.css`

**Interfaces:** Consumes `usePersistedState`, `timeInWindow`, `formatDuration`, `config`, `useThresholds` (already used). Adds a persisted `inWindow` chip; passes `inWindow` to `BandChart`.

- [ ] **Step 1: Add the failing test** to `HistoryChart.test.tsx`

```tsx
it("toggles the in-window chip and persists it", () => {
  render(<HistoryChart observations={obs} nowMs={now} />);
  const chip = screen.getByRole("button", { name: /in-window/i });
  expect(chip.className).not.toMatch(/on/);
  fireEvent.click(chip);
  expect(JSON.parse(localStorage.getItem("dc.chart.inWindow")!)).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/HistoryChart.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** — in `HistoryChart.tsx`:
- Add imports: `import { timeInWindow } from "../../chartData";` (extend existing import), `import { formatDuration } from "../../format";`, `import { config } from "../../config";`.
- Add state: `const [inWindow, setInWindow] = usePersistedState<boolean>("dc.chart.inWindow", false);`
- Compute (after `sliced`): `const mins = timeInWindow(sliced, t, config.ridingStartHour, config.ridingEndHour);`
- Add the chip to the `.hours-toggle` row (after the Riding/Full buttons):
```tsx
        <button className={`seg inwin${inWindow ? " on" : ""}`} onClick={() => setInWindow(!inWindow)} title="time in your range">
          ◑ in-window · {formatDuration(mins)}
        </button>
```
- Pass the prop to BandChart: `<BandChart points={bandPoints(ridingHoursFilter(sliced, hours), t)} showDayLabels={range === "week"} inWindow={inWindow} />`. (MonthBars unchanged — no `inWindow`.)

Append to `theme.css`:
```css
.seg.inwin { border-radius: 999px; }
```

- [ ] **Step 4: Run tests + build**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/chart/HistoryChart.test.tsx && npm run build`
Expected: PASS + build succeeds.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/chart/HistoryChart.tsx web/src/components/chart/HistoryChart.test.tsx web/src/theme.css
git commit -m "feat: in-window chip (persisted) + time stat in HistoryChart"
```

---

## Task 7: Mobile kite entry (form + button) + full verification

**Files:** Modify `web/src/components/CalibrationPanel.tsx`, `web/src/components/CalibrationPanel.test.tsx`, `web/src/theme.css`

**Interfaces:** kite input inside a `<form onSubmit>`; visible "＋" add button; remove buttons `type="button"`.

- [ ] **Step 1: Add the failing test** to `CalibrationPanel.test.tsx`

```tsx
it("adds a kite via the add button (mobile-safe)", () => {
  const update = vi.fn();
  render(<CalibrationPanel profile={EMPTY_PROFILE} update={update} nudge={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText("+ add"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "add kite" }));
  expect(update).toHaveBeenCalledWith({ kites: [12] });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/CalibrationPanel.test.tsx`
Expected: FAIL (no "add kite" button).

- [ ] **Step 3: Implement** — in `CalibrationPanel.tsx`, change the kite chips container from `<div className="calib-kites">…</div>` to a form, give the remove buttons `type="button"`, drop the input's `onKeyDown`, and add the "＋" button:
```tsx
      <form className="calib-kites" onSubmit={(e) => { e.preventDefault(); addKite(); }}>
        {profile.kites.map((k) => (
          <span className="kite-chip" key={k}>{k} <button type="button" aria-label={`remove ${k}`} onClick={() => removeKite(k)}>✕</button></span>
        ))}
        <input className="calib-in kite-in" value={newKite} onChange={(e) => setNewKite(e.target.value)} inputMode="decimal" placeholder="+ add" />
        <button type="submit" className="kite-add" aria-label="add kite">＋</button>
      </form>
```
Append to `theme.css`:
```css
.kite-add { background: var(--bg); border: 1px solid var(--accent); color: var(--accent); border-radius: 8px; padding: 4px 10px; font: inherit; font-size: 15px; cursor: pointer; line-height: 1; }
```

- [ ] **Step 4: Run the component test**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/CalibrationPanel.test.tsx`
Expected: PASS (add-button + existing tests, incl. the earlier Enter/nudge tests, stay green).

- [ ] **Step 5: FULL suite + build + dev-run**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npm test && npm run build`
Expected: ALL pass; build succeeds.
Then `npm run dev` (manual): confirm Day shows every hour; Week shows day labels + noon/3p; y-axis reads 0,5,10,…; the in-window chip toggles the dim + shows "Nh Mm"; on mobile-width the kite "＋"/Enter both add. Stop the dev server. Adjust rendering only if needed, keeping tests green.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/CalibrationPanel.tsx web/src/components/CalibrationPanel.test.tsx web/src/theme.css
git commit -m "fix: mobile-safe kite entry (form + add button)"
```

---

## Self-Review Notes (author)

- **Spec coverage:** x-axis Day/Week ticks (§2.1 → T1 hourTicks + T3 BandChart); y-axis fives (§2.2 → T1 fiveTicks + T3/T5); time-in-window stat + chip + dim (§2.3 → T2 timeInWindow/formatDuration + T4 dim + T6 chip); mobile kite entry (§2.4 → T7). Config `weekMarkerHours` (T1).
- **Type consistency:** `fiveTicks`/`hourTicks`/`AxisTick` (T1) consumed by BandChart (T3) + MonthBars (T5); `timeInWindow`/`formatDuration` (T2) consumed by HistoryChart (T6); `inWindow` prop defined in T4, supplied in T6; the two existing BandChart tests are updated for the required `inWindow` prop in T4.
- **Rendering caveat:** in/out split may show tiny gaps at transitions (connectNulls=false) — acceptable, verified in the T7 dev-run.
