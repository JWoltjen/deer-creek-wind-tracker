# Rider Calibration (Phase II) — Design

**Date:** 2026-08-09
**Author:** Jeff Woltjen (with Claude)
**Status:** Approved design (via visual companion), pending spec review
**Builds on:** the UI polish round; realizes the Phase II hook the config work set up.

## 1. Problem / Goal

The app's "good wind" band (`goodLowMph 15 / goodHighMph 26`) is hard-coded to one rider (Jeff: 220 lb, 12 + 15 m², beginner) and drives the verdict, category colors, and every chart's good-zone. Phase II lets a rider enter their own gear so the band is **computed for them** instead of hard-coded, and adds a live **"which kite to rig"** call. Also: the browser tab currently says "Web" (Vite default) — fix it.

## 2. Scope Decisions (agreed)

- **Replace, don't overlay.** A calibrated rider's computed band *becomes* the app-wide good band (verdict, colors, all charts, the History good-zone). One shaded band, never louder than today. Uncalibrated → today's generic defaults (15–26).
- **Compute + fine-tune.** Calibration computes an estimate from gear, shows it, and offers two nudges (low/high) to match real feel. The nudged range is what everything uses.
- **No lookup table.** A small parametric formula (~5 constants) computes for any rider continuously — not an enumerated table.

## 3. Inputs & Profile

The rider profile (persisted, see §9):
- `kites: number[]` — kite sizes in m² (one or more; e.g. `[12, 15]`).
- `weightLb: number` — rider weight in pounds.
- `boardCm: number` — main/biggest board length in cm.
- `skill: "beginner" | "intermediate" | "advanced"`.
- `lowAdjust: number`, `highAdjust: number` — nudge offsets in mph (integers, default 0).

"Calibrated" ≡ `kites.length > 0 && weightLb > 0`. Board/skill have sensible defaults if blank (`boardCm` = reference 138, `skill` = "intermediate").

## 4. The Model (pure formula)

Physics: a kite's power scales with area × wind², and planing needs power roughly proportional to rider weight, so the sweet-spot wind scales as `√(weight ÷ area)`, anchored to one reference point.

Constants (starting values; tune to the anchor in §4.1):
- `REF_MID_MPH = 18`, `REF_WEIGHT_LB = 165`, `REF_AREA_M2 = 12`
- `KITE_LOW_FACTOR = 0.80`, `KITE_HIGH_FACTOR = 1.25`
- `REF_BOARD_CM = 138`, `BOARD_MPH_PER_CM = 0.06` (board low-end effect, clamped to ±3 mph)
- Skill deltas (mph): beginner `{ low: +1, high: -3 }`, intermediate `{ 0, 0 }`, advanced `{ low: -1, high: +2 }`

Computation (`computeGoodBand(profile) → { low, high }`):
1. `midWind(w, a) = REF_MID_MPH × √( (w / REF_WEIGHT_LB) × (REF_AREA_M2 / a) )`.
2. Per kite: `kiteLow = midWind × KITE_LOW_FACTOR`, `kiteHigh = midWind × KITE_HIGH_FACTOR`.
3. Quiver: `rawLow = min(kiteLow over kites)` (biggest kite sets the floor), `rawHigh = max(kiteHigh over kites)` (smallest kite sets the ceiling).
4. Board: `boardLowAdj = clamp((boardCm − REF_BOARD_CM) × BOARD_MPH_PER_CM, 0, 3)`; `rawLow −= boardLowAdj`.
5. Skill: `low = rawLow + skill.low`, `high = rawHigh + skill.high`.
6. Round to integers; enforce `low < high` (if inverted, fall back to `low, low+1`).

The final good band = `computeGoodBand` **plus nudges**: `goodLow = computed.low + lowAdjust`, `goodHigh = computed.high + highAdjust`.

### 4.1 Anchor (acceptance criterion)
Tune the constants so that a **neutral** rider matching Jeff's gear — `weightLb 220, kites [12,15], boardCm 140, skill "intermediate"` — yields **`{ low: 15, high: 26 }` (±1)**, reproducing the current hand-tuned band. With `skill "beginner"` (Jeff's real profile) the band comes out narrower (~16–24), which is intended and safer for a beginner. Both are unit-tested.

## 5. Nudges
Two steppers (low −/+, high −/+), each adjusting its offset by 1 mph. **Nudges reset to 0 whenever gear inputs change** (kites/weight/board/skill), so the estimate is always the fresh baseline; the rider re-nudges if needed. The panel shows the final (nudged) range.

## 6. Kite Recommendation
`recommendKite(kites: number[], weightLb, currentMidWind) → { kite: number | null, note: string }`. Each kite has a range (from §4 steps 1–2). Given the current reading's mid wind:
- Wind within exactly one kite's range → recommend it: **"Rig your 15 m²."**
- Within two kites' ranges → recommend the one whose sweet-spot is closest, note the other: **"15 m² — grab the 12 if it builds."**
- Below every kite's low → **"Too light for your kites."**
- Above every kite's high → **"Overpowered — 12 m² only, or sit it out."** (leans safe.)

Placement: the **Right-now (Verdict) card**, shown when calibrated with ≥ 1 kite. Uses the latest reading's mid `(low+high)/2`. Uncalibrated → not shown.

## 7. Effective-Thresholds Architecture
The computed band must flow to `classify`/`steadiness` and every chart's good-zone. Approach:
- A pure `effectiveThresholds(profile) → { goodLowMph, goodHighMph, steadySpreadMax, gustySpreadMax }` — profile-derived when calibrated, else the `config` defaults.
- A React `ThresholdsContext` provided at the App root (value recomputed when the profile changes) + a `useThresholds()` hook for components.
- `classify` and `steadiness` gain an explicit thresholds parameter: `classify(low, high, thresholds)`, `steadiness(low, high, thresholds)` (defaulting to `config` keeps existing call-sites/tests working incrementally).
- Chart-data helpers that call `classify` (`bandPoints`, `dailyBars`) take a `thresholds` argument threaded from the components (which read `useThresholds()`); BandChart/MonthBars good-zone `ReferenceArea` use the same thresholds.
- Verdict/RecentReadings/HourPattern read `useThresholds()` and pass it to `classify`.

This threading is invasive but explicit and testable; the plan decomposes it so each step keeps tests green.

## 8. Calibration Panel UI
A new **`CalibrationPanel`** rendered inside a `CollapsiblePanel` titled **"Your setup"**, placed **after Right-now, full-width** (before History). Contents:
- Kite chips (add/remove m² values) + "+ add".
- Weight (lb) and Board (cm) number inputs.
- Skill segmented control (Beginner / Intermediate / Advanced).
- A divider, then the computed **"Your good range"** with the two nudges and the note "estimated from your gear · resets if you change gear".
- Uncalibrated state: a short "Not calibrated — using generic defaults. Add your gear to personalize." prompt; the good band stays generic until calibrated.
Collapsible like every other panel (open by default, collapse state remembered).

## 9. Persistence
The profile persists in `localStorage` via the existing `usePersistedState` under key **`dc.profile`**. A `useProfile()` convenience hook wraps it and exposes the profile + updaters (which reset nudges on gear change). No accounts/back end; per-browser only.

## 10. Band Visualization ("not too loud")
Because the band is *replaced*, the History good-zone stays the same single faint cyan `ReferenceArea` it is today — now spanning the rider's range — with a tiny "your range" text cue when calibrated. No second band, no added chrome.

## 11. Tab Title
`web/index.html` `<title>` → **"Barbed Wire Beach Wind"** (replace the default "Web").

## 12. Testing
- `computeGoodBand`: the §4.1 anchor (intermediate Jeff → 15–26 ±1), beginner-narrows, single-kite, multi-kite union, board/skill effects, `low < high` guard. Pure TDD.
- `recommendKite`: each of the four cases in §6. Pure TDD.
- `effectiveThresholds`: calibrated vs default. Pure TDD.
- `useProfile`/persistence: nudge reset on gear change; localStorage round-trip.
- `CalibrationPanel`: renders inputs; editing recomputes the shown range; nudges adjust it; uncalibrated prompt.
- `Verdict`: kite call rendered when calibrated (each edge case string); absent when uncalibrated.
- Threading: existing `classify`/chart tests stay green (default param); add a test that a non-default thresholds object changes categorization.
- Full web suite + build green.

## 13. Out of Scope
- Accounts, profile sharing, multiple saved profiles, server storage.
- Changing the collectors or data model.
- kg/knots unit toggles (lb/mph/cm/m² only for now).

## 14. Open Assumptions (flag if wrong)
- Weight in **lb**, kite in **m²**, board length in **cm**, wind in **mph**.
- Model constants per §4, tuned to the §4.1 anchor.
- "Your setup" panel sits after Right-now, full-width, open by default.
- Kite call shows for ≥1 kite; nudges reset on gear change.
