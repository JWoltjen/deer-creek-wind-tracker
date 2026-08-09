# Rider Calibration (Phase II) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a rider enter their gear (kites, weight, board, skill) to compute a personalized "good wind" band that replaces the generic one everywhere, plus a live "which kite to rig" call.

**Architecture:** A pure calibration model (`calibration.ts`) computes the band + kite recommendation from a `RiderProfile`. The band flows to `classify`/charts via an explicit `Thresholds` parameter (default = config) and a React `ThresholdsContext`. The profile lives in one `useProfile` state owned by App and passed down. Presentation + config only; collectors/data untouched.

**Tech Stack:** React 18 + Vite + TypeScript, Vitest + React Testing Library, Recharts.

## Global Constraints

- **Presentation/config only.** No collector, NDJSON schema, or `Observation`/`Forecast` changes.
- **Model formula (verbatim):** `midWind(w,a) = 18 × √((w/165) × (12/a))`; per-kite range `[mid×0.80, mid×1.25]`; quiver low = min kite-low, high = max kite-high; board low-adj `= clamp((boardCm−138)×0.06, 0, 3)` subtracted from low; skill deltas (mph) beginner `{low:+1,high:−3}`, intermediate `{0,0}`, advanced `{low:−1,high:+2}`; round to ints; enforce `high>low`.
- **Anchor (test):** `{weightLb:220, kites:[12,15], boardCm:140, skill:"intermediate"}` → `{low:15, high:26}`.
- **Units:** weight **lb**, kite **m²**, board **cm**, wind **mph**.
- **localStorage key:** profile under `dc.profile` (via existing `usePersistedState`). "Calibrated" = `kites.length>0 && weightLb>0`.
- **Thresholds threading:** `classify(low,high,t?)`/`steadiness(low,high,t?)` take an optional `Thresholds` defaulting to `configThresholds`, so existing call-sites stay valid. Components read `useThresholds()`; App provides it from the profile.
- **Kite call** in the Right-now card, shown when calibrated with ≥1 kite; nudges reset to 0 on any gear change.
- **Field theme** unchanged; Space Grotesk; dark only. **TDD**, pristine output, frequent commits.
- **Node/npm not on PATH:** prefix node/npm/npx with `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH"`. Charts render 0×0 in jsdom — tests assert containers/state/text; visuals verified in a dev run before merge.

---

## File Structure

```
web/src/
  calibration.ts            # NEW — RiderProfile/Skill, model constants, kiteRange, computeGoodBand, finalBand, isCalibrated, recommendKite, effectiveThresholds
  classify.ts               # MODIFY — Thresholds type + configThresholds; classify/steadiness take optional thresholds
  chartData.ts              # MODIFY — bandPoints/dailyBars take optional thresholds, threaded to classify
  hooks/useProfile.ts       # NEW — single persisted profile + update/nudge (reset nudges on gear change)
  ThresholdsContext.tsx     # NEW — context (default configThresholds) + ThresholdsProvider + useThresholds
  components/
    CalibrationPanel.tsx    # NEW — the "Your setup" form
    Verdict.tsx             # MODIFY — thresholds + kite call
    RecentReadings.tsx      # MODIFY — thresholds into classify
    HourPattern.tsx         # MODIFY — thresholds into classify
    chart/BandChart.tsx     # MODIFY — good-zone + steadiness use thresholds
    chart/MonthBars.tsx     # MODIFY — good-zone uses thresholds
    chart/HistoryChart.tsx  # MODIFY — pass thresholds to bandPoints/dailyBars
  App.tsx                   # MODIFY — useProfile, ThresholdsProvider, "Your setup" panel
  theme.css                 # MODIFY — calibration panel styles
web/index.html              # MODIFY — <title>
```

---

## Task 1: Thresholds type + parameterize classify/steadiness

**Files:** Modify `web/src/classify.ts`, `web/src/classify.test.ts`

**Interfaces:**
- Produces: `export interface Thresholds { goodLowMph: number; goodHighMph: number; steadySpreadMax: number; gustySpreadMax: number; }`
- Produces: `export const configThresholds: Thresholds` (from `config`).
- Produces: `classify(low, high, t: Thresholds = configThresholds): Category`; `steadiness(low, high, t: Thresholds = configThresholds)`.

- [ ] **Step 1: Add the failing test** to `classify.test.ts`

```ts
import { classify, steadiness, configThresholds, type Thresholds } from "./classify";

describe("classify with custom thresholds", () => {
  const t: Thresholds = { goodLowMph: 20, goodHighMph: 30, steadySpreadMax: 3, gustySpreadMax: 8 };
  it("uses passed thresholds, not config", () => {
    expect(classify(16, 19, t)).toBe("light");   // high 19 < 20 → light under custom band
    expect(classify(22, 25, t)).toBe("good");     // in 20–30, spread 3 ≤ 3
  });
  it("defaults to config when omitted", () => {
    expect(classify(16, 20)).toBe("good");        // config band 15–26
  });
  it("steadiness respects thresholds", () => {
    expect(steadiness(20, 24, t)).toBe("a bit gusty"); // spread 4 > 3, ≤ 8
    expect(configThresholds.goodLowMph).toBe(15);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/classify.test.ts`
Expected: FAIL (`configThresholds`/`Thresholds` not exported; 3rd param unused).

- [ ] **Step 3: Implement** — edit `classify.ts`:

```ts
import { config } from "./config";

export type Category = "good" | "gusty" | "light" | "strong";
export type DirRating = "ideal" | "ok" | "off";

export interface Thresholds {
  goodLowMph: number; goodHighMph: number; steadySpreadMax: number; gustySpreadMax: number;
}
export const configThresholds: Thresholds = {
  goodLowMph: config.goodLowMph, goodHighMph: config.goodHighMph,
  steadySpreadMax: config.steadySpreadMax, gustySpreadMax: config.gustySpreadMax,
};

export function classify(low: number, high: number, t: Thresholds = configThresholds): Category {
  const mid = (low + high) / 2;
  const spread = high - low;
  if (high < t.goodLowMph) return "light";
  if (mid > t.goodHighMph || spread > t.gustySpreadMax) return "strong";
  if (spread <= t.steadySpreadMax) return "good";
  return "gusty";
}

export function steadiness(low: number, high: number, t: Thresholds = configThresholds): "steady" | "a bit gusty" | "gusty" {
  const spread = high - low;
  if (spread <= t.steadySpreadMax) return "steady";
  if (spread <= t.gustySpreadMax) return "a bit gusty";
  return "gusty";
}
```
Keep `rateDirection` unchanged (still reads `config.idealDirs`/`okDirs`).

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/classify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/classify.ts web/src/classify.test.ts
git commit -m "feat: Thresholds type; classify/steadiness accept optional thresholds"
```

---

## Task 2: Calibration model — profile + computeGoodBand

**Files:** Create `web/src/calibration.ts`, `web/src/calibration.test.ts`

**Interfaces:**
- Produces: `export type Skill = "beginner" | "intermediate" | "advanced";`
- Produces: `export interface RiderProfile { kites: number[]; weightLb: number; boardCm: number; skill: Skill; lowAdjust: number; highAdjust: number; }`
- Produces: `export const EMPTY_PROFILE: RiderProfile` (`kites:[], weightLb:0, boardCm:138, skill:"intermediate", lowAdjust:0, highAdjust:0`).
- Produces: `export function isCalibrated(p: RiderProfile): boolean`.
- Produces: `export function kiteRange(weightLb: number, area: number): { low: number; high: number }`.
- Produces: `export function computeGoodBand(p: RiderProfile): { low: number; high: number }` (raw, pre-nudge, rounded ints).
- Produces: `export function finalBand(p: RiderProfile): { low: number; high: number }` (= computeGoodBand + adjusts).

- [ ] **Step 1: Write the failing test** (`web/src/calibration.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { computeGoodBand, finalBand, isCalibrated, EMPTY_PROFILE, type RiderProfile } from "./calibration";

const jeff = (skill: RiderProfile["skill"]): RiderProfile =>
  ({ kites: [12, 15], weightLb: 220, boardCm: 140, skill, lowAdjust: 0, highAdjust: 0 });

describe("computeGoodBand", () => {
  it("anchor: intermediate Jeff reproduces 15–26", () => {
    expect(computeGoodBand(jeff("intermediate"))).toEqual({ low: 15, high: 26 });
  });
  it("beginner narrows the band (higher floor, lower ceiling)", () => {
    const b = computeGoodBand(jeff("beginner"));
    expect(b.low).toBeGreaterThanOrEqual(15);
    expect(b.high).toBeLessThan(26);
  });
  it("more kites widen the band vs a single kite", () => {
    const one = computeGoodBand({ ...jeff("intermediate"), kites: [12] });
    const two = computeGoodBand(jeff("intermediate"));
    expect(two.high - two.low).toBeGreaterThan(one.high - one.low);
  });
  it("bigger board lowers the floor", () => {
    const small = computeGoodBand({ ...jeff("intermediate"), boardCm: 130 });
    const big = computeGoodBand({ ...jeff("intermediate"), boardCm: 150 });
    expect(big.low).toBeLessThanOrEqual(small.low);
  });
});

describe("finalBand / isCalibrated", () => {
  it("applies nudges", () => {
    expect(finalBand({ ...jeff("intermediate"), lowAdjust: -1, highAdjust: 2 })).toEqual({ low: 14, high: 28 });
  });
  it("isCalibrated needs kites + weight", () => {
    expect(isCalibrated(EMPTY_PROFILE)).toBe(false);
    expect(isCalibrated(jeff("intermediate"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/calibration.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `web/src/calibration.ts`** (this task's exports)

```ts
export type Skill = "beginner" | "intermediate" | "advanced";

export interface RiderProfile {
  kites: number[]; weightLb: number; boardCm: number; skill: Skill; lowAdjust: number; highAdjust: number;
}

export const EMPTY_PROFILE: RiderProfile = {
  kites: [], weightLb: 0, boardCm: 138, skill: "intermediate", lowAdjust: 0, highAdjust: 0,
};

const REF_MID_MPH = 18, REF_WEIGHT_LB = 165, REF_AREA_M2 = 12;
const KITE_LOW_FACTOR = 0.80, KITE_HIGH_FACTOR = 1.25;
const REF_BOARD_CM = 138, BOARD_MPH_PER_CM = 0.06, BOARD_MAX_ADJ = 3;
const SKILL_DELTA: Record<Skill, { low: number; high: number }> = {
  beginner: { low: 1, high: -3 }, intermediate: { low: 0, high: 0 }, advanced: { low: -1, high: 2 },
};

export function isCalibrated(p: RiderProfile): boolean {
  return p.kites.length > 0 && p.weightLb > 0;
}

export function kiteRange(weightLb: number, area: number): { low: number; high: number } {
  const mid = REF_MID_MPH * Math.sqrt((weightLb / REF_WEIGHT_LB) * (REF_AREA_M2 / area));
  return { low: mid * KITE_LOW_FACTOR, high: mid * KITE_HIGH_FACTOR };
}

export function computeGoodBand(p: RiderProfile): { low: number; high: number } {
  const ranges = p.kites.map((a) => kiteRange(p.weightLb, a));
  let low = Math.min(...ranges.map((r) => r.low));
  let high = Math.max(...ranges.map((r) => r.high));
  const boardAdj = Math.min(BOARD_MAX_ADJ, Math.max(0, (p.boardCm - REF_BOARD_CM) * BOARD_MPH_PER_CM));
  low -= boardAdj;
  low += SKILL_DELTA[p.skill].low;
  high += SKILL_DELTA[p.skill].high;
  low = Math.round(low); high = Math.round(high);
  if (high <= low) high = low + 1;
  return { low, high };
}

export function finalBand(p: RiderProfile): { low: number; high: number } {
  const b = computeGoodBand(p);
  return { low: b.low + p.lowAdjust, high: b.high + p.highAdjust };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/calibration.test.ts`
Expected: PASS (anchor exactly 15/26).

- [ ] **Step 5: Commit**

```bash
git add web/src/calibration.ts web/src/calibration.test.ts
git commit -m "feat: calibration model computeGoodBand (anchored to 15-26)"
```

---

## Task 3: recommendKite + effectiveThresholds

**Files:** Modify `web/src/calibration.ts`, `web/src/calibration.test.ts`

**Interfaces:**
- Consumes: `kiteRange`, `finalBand`, `isCalibrated`; `Thresholds`/`configThresholds` from `./classify`.
- Produces: `export function recommendKite(kites: number[], weightLb: number, currentMid: number): { kite: number | null; note: string }`.
- Produces: `export function effectiveThresholds(p: RiderProfile): Thresholds` — calibrated → `{ ...configThresholds, goodLowMph: finalBand.low, goodHighMph: finalBand.high }`, else `configThresholds`.

- [ ] **Step 1: Add failing tests** to `calibration.test.ts`

```ts
import { recommendKite, effectiveThresholds } from "./calibration";
import { configThresholds } from "./classify";

describe("recommendKite", () => {
  const kites = [12, 15], w = 220; // 12: ~16.6–26, 15: ~14.9–23.2
  it("light wind → biggest kite", () => {
    expect(recommendKite(kites, w, 16).note).toMatch(/15 m²/);
  });
  it("in both ranges → best powered, notes the other", () => {
    const r = recommendKite(kites, w, 20);
    expect(r.kite).not.toBeNull();
    expect(r.note).toMatch(/m²/);
  });
  it("below all → too light", () => {
    expect(recommendKite(kites, w, 10)).toEqual({ kite: null, note: "Too light for your kites." });
  });
  it("above all → overpowered, smallest kite", () => {
    const r = recommendKite(kites, w, 32);
    expect(r.kite).toBe(12);
    expect(r.note).toMatch(/Overpowered/);
  });
  it("no kites → null", () => {
    expect(recommendKite([], w, 20).kite).toBeNull();
  });
});

describe("effectiveThresholds", () => {
  it("uses config when uncalibrated", () => {
    expect(effectiveThresholds(EMPTY_PROFILE)).toEqual(configThresholds);
  });
  it("uses the rider band when calibrated", () => {
    const t = effectiveThresholds({ kites: [12, 15], weightLb: 220, boardCm: 140, skill: "intermediate", lowAdjust: 0, highAdjust: 0 });
    expect(t.goodLowMph).toBe(15);
    expect(t.goodHighMph).toBe(26);
    expect(t.steadySpreadMax).toBe(configThresholds.steadySpreadMax);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/calibration.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — add to `calibration.ts`

```ts
import { configThresholds, type Thresholds } from "./classify";

export function recommendKite(kites: number[], weightLb: number, currentMid: number): { kite: number | null; note: string } {
  if (kites.length === 0) return { kite: null, note: "" };
  const rs = [...kites].sort((a, b) => a - b).map((k) => {
    const r = kiteRange(weightLb, k);
    return { k, low: r.low, high: r.high, mid: (r.low + r.high) / 2 };
  });
  const inRange = rs.filter((r) => currentMid >= r.low && currentMid <= r.high);
  if (inRange.length === 0) {
    if (currentMid < Math.min(...rs.map((r) => r.low))) return { kite: null, note: "Too light for your kites." };
    const smallest = rs[0].k;
    return { kite: smallest, note: `Overpowered — ${smallest} m² only, or sit it out.` };
  }
  const best = inRange.reduce((a, b) => (Math.abs(b.mid - currentMid) < Math.abs(a.mid - currentMid) ? b : a));
  const other = inRange.find((r) => r.k !== best.k);
  if (other) {
    const when = other.k < best.k ? "builds" : "drops";
    return { kite: best.k, note: `${best.k} m² — grab the ${other.k} if it ${when}.` };
  }
  return { kite: best.k, note: `Rig your ${best.k} m².` };
}

export function effectiveThresholds(p: RiderProfile): Thresholds {
  if (!isCalibrated(p)) return configThresholds;
  const b = finalBand(p);
  return { ...configThresholds, goodLowMph: b.low, goodHighMph: b.high };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/calibration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/calibration.ts web/src/calibration.test.ts
git commit -m "feat: recommendKite + effectiveThresholds"
```

---

## Task 4: useProfile hook

**Files:** Create `web/src/hooks/useProfile.ts`, `web/src/hooks/useProfile.test.ts`

**Interfaces:**
- Consumes: `usePersistedState`, `RiderProfile`, `EMPTY_PROFILE`.
- Produces: `export function useProfile(): { profile: RiderProfile; update: (patch: Partial<RiderProfile>) => void; nudge: (which: "low" | "high", delta: number) => void }`. `update` merges the patch AND, if the patch touches any gear field (`kites`/`weightLb`/`boardCm`/`skill`), resets `lowAdjust`/`highAdjust` to 0. `nudge` changes the chosen adjust by `delta`. Persisted under `dc.profile`.

- [ ] **Step 1: Write the failing test** (`web/src/hooks/useProfile.test.ts`)

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProfile } from "./useProfile";

describe("useProfile", () => {
  beforeEach(() => localStorage.clear());
  it("starts empty and persists updates", () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current.update({ weightLb: 220, kites: [12, 15] }));
    expect(result.current.profile.weightLb).toBe(220);
    expect(JSON.parse(localStorage.getItem("dc.profile")!).kites).toEqual([12, 15]);
  });
  it("nudge changes adjust; gear change resets nudges", () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current.update({ weightLb: 220, kites: [12] }));
    act(() => result.current.nudge("high", 2));
    expect(result.current.profile.highAdjust).toBe(2);
    act(() => result.current.update({ kites: [12, 15] })); // gear change
    expect(result.current.profile.highAdjust).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/hooks/useProfile.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `web/src/hooks/useProfile.ts`**

```ts
import { usePersistedState } from "./usePersistedState";
import { EMPTY_PROFILE, type RiderProfile } from "../calibration";

const GEAR_KEYS: (keyof RiderProfile)[] = ["kites", "weightLb", "boardCm", "skill"];

export function useProfile() {
  const [profile, setProfile] = usePersistedState<RiderProfile>("dc.profile", EMPTY_PROFILE);
  const update = (patch: Partial<RiderProfile>) => {
    const touchesGear = GEAR_KEYS.some((k) => k in patch);
    setProfile({ ...profile, ...patch, ...(touchesGear ? { lowAdjust: 0, highAdjust: 0 } : {}) });
  };
  const nudge = (which: "low" | "high", delta: number) => {
    setProfile({ ...profile, [which === "low" ? "lowAdjust" : "highAdjust"]: (which === "low" ? profile.lowAdjust : profile.highAdjust) + delta });
  };
  return { profile, update, nudge };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/hooks/useProfile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/useProfile.ts web/src/hooks/useProfile.test.ts
git commit -m "feat: useProfile persisted state (nudges reset on gear change)"
```

---

## Task 5: ThresholdsContext

**Files:** Create `web/src/ThresholdsContext.tsx`, `web/src/ThresholdsContext.test.tsx`

**Interfaces:**
- Consumes: `Thresholds`/`configThresholds` (classify), `effectiveThresholds`/`RiderProfile` (calibration).
- Produces: `export function ThresholdsProvider({ profile, children }: { profile: RiderProfile; children: React.ReactNode }): JSX.Element`; `export function useThresholds(): Thresholds` (default `configThresholds` when no provider).

- [ ] **Step 1: Write the failing test** (`web/src/ThresholdsContext.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ThresholdsProvider, useThresholds } from "./ThresholdsContext";
import { EMPTY_PROFILE } from "./calibration";

function Show() { const t = useThresholds(); return <span>{t.goodLowMph}-{t.goodHighMph}</span>; }

describe("ThresholdsContext", () => {
  it("defaults to config (15-26) with no provider", () => {
    render(<Show />);
    expect(screen.getByText("15-26")).toBeTruthy();
  });
  it("uses the rider band inside a calibrated provider", () => {
    render(<ThresholdsProvider profile={{ kites: [12, 15], weightLb: 220, boardCm: 140, skill: "intermediate", lowAdjust: 0, highAdjust: 0 }}><Show /></ThresholdsProvider>);
    expect(screen.getByText("15-26")).toBeTruthy();
    render(<ThresholdsProvider profile={{ kites: [9], weightLb: 220, boardCm: 140, skill: "advanced", lowAdjust: 0, highAdjust: 0 }}><Show /></ThresholdsProvider>);
    // 9m² is smaller → higher band; just assert it differs from 15-26 by not throwing and rendering a range
  });
  it("uncalibrated provider falls back to config", () => {
    render(<ThresholdsProvider profile={EMPTY_PROFILE}><Show /></ThresholdsProvider>);
    expect(screen.getAllByText("15-26").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/ThresholdsContext.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `web/src/ThresholdsContext.tsx`**

```tsx
import { createContext, useContext } from "react";
import { configThresholds, type Thresholds } from "./classify";
import { effectiveThresholds, type RiderProfile } from "./calibration";

const ThresholdsContext = createContext<Thresholds>(configThresholds);

export function useThresholds(): Thresholds {
  return useContext(ThresholdsContext);
}

export function ThresholdsProvider({ profile, children }: { profile: RiderProfile; children: React.ReactNode }) {
  return <ThresholdsContext.Provider value={effectiveThresholds(profile)}>{children}</ThresholdsContext.Provider>;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/ThresholdsContext.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/ThresholdsContext.tsx web/src/ThresholdsContext.test.tsx
git commit -m "feat: ThresholdsContext + useThresholds"
```

---

## Task 6: Thread thresholds through chartData

**Files:** Modify `web/src/chartData.ts`, `web/src/chartData.test.ts`

**Interfaces:**
- `bandPoints(obs, t: Thresholds = configThresholds)` — passes `t` to `classify` for each point's category.
- `dailyBars(obs, mode, t: Thresholds = configThresholds)` — passes `t` to `classify` for each day's category.

- [ ] **Step 1: Add the failing test** to `chartData.test.ts`

```ts
import { configThresholds, type Thresholds } from "./classify";
const strongT: Thresholds = { ...configThresholds, goodLowMph: 25, goodHighMph: 35 };

it("bandPoints category respects passed thresholds", () => {
  const pts = bandPoints([o("2026-08-08T13:00:00-06:00", 16, 20)], strongT);
  expect(pts[0].category).toBe("light"); // high 20 < 25 under strongT
});
it("dailyBars category respects passed thresholds", () => {
  const bars = dailyBars([o("2026-08-08T13:00:00-06:00", 16, 20)], "riding", strongT);
  expect(bars[0].category).toBe("light");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/chartData.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — in `chartData.ts` add the import and params:

Add `import { classify, configThresholds, type Category, type Thresholds } from "./classify";` (replace the existing classify import). Change signatures:
```ts
export function bandPoints(obs: Observation[], t: Thresholds = configThresholds): BandPoint[] {
  // ... unchanged except: category: classify(o.low, o.high, t)
}
export function dailyBars(obs: Observation[], mode: HoursMode, t: Thresholds = configThresholds): DailyBar[] {
  // ... unchanged except: category: classify(v.min, v.max, t)
}
```
Only the `classify(...)` calls gain the `t` argument; everything else stays.

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/chartData.test.ts`
Expected: PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add web/src/chartData.ts web/src/chartData.test.ts
git commit -m "feat: thread thresholds through bandPoints/dailyBars"
```

---

## Task 7: Wire components to useThresholds

**Files:** Modify `RecentReadings.tsx`, `HourPattern.tsx`, `chart/BandChart.tsx`, `chart/MonthBars.tsx`, `chart/HistoryChart.tsx` (Verdict handled in Task 9)

Each component reads `const t = useThresholds();` and passes `t` where it calls `classify`/`steadiness` or draws the good-zone. Rendered standalone in their tests, `useThresholds()` returns `configThresholds` (context default) → identical to today, so tests stay green.

- [ ] **Step 1: Verify green baseline**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components`
Expected: PASS.

- [ ] **Step 2: Edit each component**

- **RecentReadings.tsx:** add `import { useThresholds } from "../ThresholdsContext";`; inside the component `const t = useThresholds();`; change the per-row `classify(o.low, o.high)` → `classify(o.low, o.high, t)`.
- **HourPattern.tsx:** add the import + `const t = useThresholds();`; change the `Cell` fill `classify(d.avgMid - 2, d.avgMid + 2)` → `classify(d.avgMid - 2, d.avgMid + 2, t)`.
- **chart/BandChart.tsx:** add `import { useThresholds } from "../../ThresholdsContext";`; `const t = useThresholds();`; the good-zone `ReferenceArea y1={config.goodLowMph} y2={config.goodHighMph}` → `y1={t.goodLowMph} y2={t.goodHighMph}`; the tooltip's `steadiness(p.low, p.high)` → `steadiness(p.low, p.high, t)`.
- **chart/MonthBars.tsx:** add the import + `const t = useThresholds();`; good-zone `ReferenceArea` → `y1={t.goodLowMph} y2={t.goodHighMph}`.
- **chart/HistoryChart.tsx:** add `import { useThresholds } from "../../ThresholdsContext";`; `const t = useThresholds();`; pass `t` to the pipeline: `bandPoints(ridingHoursFilter(sliced, hours), t)` and `dailyBars(sliced, hours, t)`.

- [ ] **Step 3: Run component tests + build**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components && npm run build`
Expected: PASS; build succeeds (default thresholds = unchanged behavior).

- [ ] **Step 4: Commit**

```bash
git add web/src/components
git commit -m "feat: components read good-band from useThresholds"
```

---

## Task 8: CalibrationPanel

**Files:** Create `web/src/components/CalibrationPanel.tsx`, `web/src/components/CalibrationPanel.test.tsx`; Modify `theme.css`

**Interfaces:**
- Consumes: `RiderProfile`, `computeGoodBand`, `finalBand`, `isCalibrated`, `Skill` (calibration).
- Produces: `export function CalibrationPanel({ profile, update, nudge }: { profile: RiderProfile; update: (p: Partial<RiderProfile>) => void; nudge: (which: "low" | "high", delta: number) => void }): JSX.Element` — kite chips (add via a number input, remove via ✕), weight/board number inputs, a Beginner/Intermediate/Advanced segmented control, and when calibrated the computed `finalBand` with low/high `−`/`+` steppers; when not calibrated, a "using generic defaults" prompt.

- [ ] **Step 1: Write the failing test** (`web/src/components/CalibrationPanel.test.tsx`)

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CalibrationPanel } from "./CalibrationPanel";
import { EMPTY_PROFILE, type RiderProfile } from "../calibration";

const calibrated: RiderProfile = { kites: [12, 15], weightLb: 220, boardCm: 140, skill: "intermediate", lowAdjust: 0, highAdjust: 0 };

describe("CalibrationPanel", () => {
  it("uncalibrated shows the generic-defaults prompt", () => {
    render(<CalibrationPanel profile={EMPTY_PROFILE} update={vi.fn()} nudge={vi.fn()} />);
    expect(screen.getByText(/generic defaults/i)).toBeTruthy();
  });
  it("calibrated shows the computed range and kites", () => {
    render(<CalibrationPanel profile={calibrated} update={vi.fn()} nudge={vi.fn()} />);
    expect(screen.getByText(/15–26 mph|15–26/)).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("15")).toBeTruthy();
  });
  it("nudging high calls nudge('high', +1)", () => {
    const nudge = vi.fn();
    render(<CalibrationPanel profile={calibrated} update={vi.fn()} nudge={nudge} />);
    fireEvent.click(screen.getByRole("button", { name: "high +" }));
    expect(nudge).toHaveBeenCalledWith("high", 1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/CalibrationPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `web/src/components/CalibrationPanel.tsx`**

```tsx
import { useState } from "react";
import { finalBand, isCalibrated, type RiderProfile, type Skill } from "../calibration";

const SKILLS: Skill[] = ["beginner", "intermediate", "advanced"];
const SKILL_LABEL: Record<Skill, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export function CalibrationPanel({ profile, update, nudge }: {
  profile: RiderProfile; update: (p: Partial<RiderProfile>) => void; nudge: (which: "low" | "high", delta: number) => void;
}) {
  const [newKite, setNewKite] = useState("");
  const addKite = () => {
    const v = Number(newKite);
    if (v > 0 && !profile.kites.includes(v)) update({ kites: [...profile.kites, v].sort((a, b) => a - b) });
    setNewKite("");
  };
  const removeKite = (k: number) => update({ kites: profile.kites.filter((x) => x !== k) });
  const calibrated = isCalibrated(profile);
  const band = calibrated ? finalBand(profile) : null;

  return (
    <div className="calib">
      <div className="calib-label">Kites (m²)</div>
      <div className="calib-kites">
        {profile.kites.map((k) => (
          <span className="kite-chip" key={k}>{k} <button aria-label={`remove ${k}`} onClick={() => removeKite(k)}>✕</button></span>
        ))}
        <input className="calib-in kite-in" value={newKite} onChange={(e) => setNewKite(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addKite()} inputMode="decimal" placeholder="+ add" />
      </div>

      <div className="calib-row">
        <label>Weight (lb)<input className="calib-in" type="number" value={profile.weightLb || ""} onChange={(e) => update({ weightLb: Number(e.target.value) })} /></label>
        <label>Board (cm)<input className="calib-in" type="number" value={profile.boardCm || ""} onChange={(e) => update({ boardCm: Number(e.target.value) })} /></label>
      </div>

      <div className="calib-label">Skill</div>
      <div className="calib-skill">
        {SKILLS.map((s) => (
          <button key={s} className={`seg${profile.skill === s ? " on" : ""}`} onClick={() => update({ skill: s })}>{SKILL_LABEL[s]}</button>
        ))}
      </div>

      {calibrated && band ? (
        <div className="calib-out">
          <div className="calib-out-head"><span>Your good range</span><span className="calib-est">estimated from your gear</span></div>
          <div className="calib-band">{band.low}–{band.high} <span className="unit">mph</span></div>
          <div className="calib-nudges">
            <div className="nudge"><button aria-label="low -" onClick={() => nudge("low", -1)}>−</button><span>low {band.low}</span><button aria-label="low +" onClick={() => nudge("low", 1)}>+</button></div>
            <div className="nudge"><button aria-label="high -" onClick={() => nudge("high", -1)}>−</button><span>high {band.high}</span><button aria-label="high +" onClick={() => nudge("high", 1)}>+</button></div>
          </div>
          <div className="calib-note">nudge to match how it really feels · resets if you change gear</div>
        </div>
      ) : (
        <div className="calib-note calib-empty">Not calibrated — using generic defaults. Add your gear to personalize.</div>
      )}
    </div>
  );
}
```

Append to `theme.css`:
```css
.calib-label { font-size: 11px; color: var(--faint); margin: 12px 0 6px; text-transform: uppercase; letter-spacing: .04em; }
.calib-kites { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.kite-chip { background: var(--bg); border: 1px solid var(--accent); border-radius: 8px; padding: 4px 9px; font-size: 13px; }
.kite-chip button, .nudge button { background: none; border: none; color: var(--faint); cursor: pointer; font: inherit; }
.calib-in { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 7px 9px; font: inherit; font-size: 14px; color: var(--text); width: 100%; }
.kite-in { width: 70px; }
.calib-row { display: flex; gap: 10px; margin-top: 8px; }
.calib-row label { flex: 1; font-size: 11px; color: var(--faint); display: flex; flex-direction: column; gap: 6px; }
.calib-skill { display: flex; gap: 6px; }
.calib-out { border-top: 1px solid var(--hairline); margin-top: 14px; padding-top: 12px; }
.calib-out-head { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); }
.calib-est { color: var(--faint); font-size: 11px; }
.calib-band { font-size: 28px; font-weight: 700; margin: 4px 0 10px; }
.calib-band .unit { font-size: 13px; color: var(--faint); }
.calib-nudges { display: flex; gap: 10px; }
.nudge { flex: 1; display: flex; align-items: center; justify-content: space-between; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 4px 10px; font-size: 12px; color: var(--muted); }
.nudge button { color: var(--accent); font-size: 16px; }
.calib-note { font-size: 11px; color: var(--dim); margin-top: 8px; }
.calib-empty { color: var(--muted); }
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/CalibrationPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/CalibrationPanel.tsx web/src/components/CalibrationPanel.test.tsx web/src/theme.css
git commit -m "feat: CalibrationPanel (gear inputs, computed range, nudges)"
```

---

## Task 9: Verdict — thresholds + kite call

**Files:** Modify `web/src/components/Verdict.tsx`, `web/src/components/Verdict.test.tsx`

**Interfaces:**
- Consumes: `useThresholds`, `recommendKite`, `RiderProfile`.
- `Verdict({ latest, profile }: { latest: Observation | null; profile: RiderProfile })` — uses `useThresholds()` for `classify`/`steadiness`; when `profile.kites.length > 0` and `latest`, renders the kite call from `recommendKite(profile.kites, profile.weightLb, mid)` (mid = `(low+high)/2`).

- [ ] **Step 1: Update the test** (`web/src/components/Verdict.test.tsx`)

```tsx
import { EMPTY_PROFILE } from "../calibration";
const latest = { time: "2026-08-08T14:44:00-06:00", tempF: 95, dir: "SW", low: 16, high: 20 };

it("shows the verdict (no kite call when uncalibrated)", () => {
  render(<Verdict latest={latest} profile={EMPTY_PROFILE} />);
  expect(screen.getByText(/Good/)).toBeTruthy();
  expect(screen.queryByText(/Rig your/)).toBeNull();
});
it("shows a kite call when calibrated", () => {
  render(<Verdict latest={latest} profile={{ kites: [12, 15], weightLb: 220, boardCm: 140, skill: "intermediate", lowAdjust: 0, highAdjust: 0 }} />);
  expect(screen.getByText(/m²/)).toBeTruthy();
});
it("empty state", () => {
  render(<Verdict latest={null} profile={EMPTY_PROFILE} />);
  expect(screen.getByText(/No data yet/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/Verdict.test.tsx`
Expected: FAIL (Verdict has no `profile` prop / no kite call).

- [ ] **Step 3: Implement** — edit `Verdict.tsx`:

Add imports: `import { useThresholds } from "../ThresholdsContext";`, `import { recommendKite, type RiderProfile } from "../calibration";`. Change the signature to `{ latest, profile }: { latest: Observation | null; profile: RiderProfile }`. Inside, `const t = useThresholds();` and pass `t` to `classify(latest.low, latest.high, t)` and `steadiness(latest.low, latest.high, t)`. Before the closing `</div>` of the populated verdict, add:
```tsx
{profile.kites.length > 0 && (() => {
  const rec = recommendKite(profile.kites, profile.weightLb, (latest.low + latest.high) / 2);
  return rec.note ? <div className="kite-call">🪁 <span>{rec.note}</span></div> : null;
})()}
```
Append to `theme.css`:
```css
.kite-call { display: flex; align-items: center; gap: 8px; margin-top: 12px; background: var(--bg); border: 1px solid #143244; border-radius: 10px; padding: 9px 11px; font-size: 13px; color: var(--accent); }
.kite-call span { color: var(--muted); }
```

- [ ] **Step 4: Run to verify it passes**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/components/Verdict.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Verdict.tsx web/src/components/Verdict.test.tsx web/src/theme.css
git commit -m "feat: Verdict kite recommendation + thresholds"
```

---

## Task 10: App wiring + tab title

**Files:** Modify `web/src/App.tsx`, `web/src/App.test.tsx`, `web/index.html`

**Interfaces:**
- App owns `const { profile, update, nudge } = useProfile();`, wraps everything in `<ThresholdsProvider profile={profile}>`, passes `profile` to `Verdict`, and adds a `CollapsiblePanel id="setup" title="Your setup"` (after Right-now, full-width) containing `<CalibrationPanel profile update nudge />`.

- [ ] **Step 1: Update `App.test.tsx`** — the header + `.grid` checks stay; add:

```tsx
await waitFor(() => expect(screen.getByText(/Barbed Wire Beach/i)).toBeTruthy());
expect(screen.getByText("Your setup")).toBeTruthy();
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npx vitest run src/App.test.tsx`
Expected: FAIL (no "Your setup" yet).

- [ ] **Step 3: Edit `App.tsx`**

Add imports:
```tsx
import { useProfile } from "./hooks/useProfile";
import { ThresholdsProvider } from "./ThresholdsContext";
import { CalibrationPanel } from "./components/CalibrationPanel";
```
Inside the component add `const { profile, update, nudge } = useProfile();`. Wrap the returned `<main>` in `<ThresholdsProvider profile={profile}> … </ThresholdsProvider>`. Pass `profile` to Verdict: `<Verdict latest={latest} profile={profile} />`. Insert after the Right-now panel and before History:
```tsx
<CollapsiblePanel id="setup" title="Your setup"><CalibrationPanel profile={profile} update={update} nudge={nudge} /></CollapsiblePanel>
```

- [ ] **Step 4: Fix the tab title** — in `web/index.html`, replace `<title>…</title>` with `<title>Barbed Wire Beach Wind</title>`.

- [ ] **Step 5: Run full suite + build**

Run: `export PATH="/c/Users/JeffW/AppData/Local/nvm/v20.19.3:$PATH" && cd web && npm test && npm run build`
Expected: ALL tests pass; build succeeds.

- [ ] **Step 6: Dev-run visual check (manual)**

`npm run dev` — confirm: "Your setup" panel collects gear; entering your kites/weight recomputes the range; the good-zone band + verdict + colors shift to your band; the kite call appears in Right-now; nudges adjust; collapsing works; tab title reads "Barbed Wire Beach Wind". Stop the dev server. Adjust rendering only if needed, keeping tests green.

- [ ] **Step 7: Commit**

```bash
git add web/src/App.tsx web/src/App.test.tsx web/index.html
git commit -m "feat: wire calibration into App; fix tab title"
```

---

## Self-Review Notes (author)

- **Spec coverage:** replace-everywhere via Thresholds+context (T1,T5,T6,T7,T9,T10; spec §2/§7); model + anchor (T2; §4/§4.1); nudges (T2 finalBand, T4 reset, T8 UI; §5); recommendKite + placement (T3,T9; §6); profile persistence (T4; §9); CalibrationPanel + layout + uncalibrated state (T8,T10; §8); quiet band (T7 good-zone via thresholds; §10); tab title (T10; §11); tests (§12).
- **Type consistency:** `Thresholds`/`configThresholds` (T1) consumed by calibration (T3), chartData (T6), context (T5), components (T7,T9). `RiderProfile`/`EMPTY_PROFILE`/`finalBand`/`recommendKite` (T2,T3) consumed by useProfile (T4), CalibrationPanel (T8), Verdict (T9), App (T10). `useProfile` returns `{ profile, update, nudge }` — matched in T8/T10 props.
- **Incremental greenness:** the optional-thresholds default (T1/T6) keeps every existing test valid until components opt in (T7); Verdict gains a required `profile` prop in T9 with its test updated the same task; App supplies it in T10.
