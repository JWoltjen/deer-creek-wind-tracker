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
