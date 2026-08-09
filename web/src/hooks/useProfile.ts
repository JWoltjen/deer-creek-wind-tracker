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
