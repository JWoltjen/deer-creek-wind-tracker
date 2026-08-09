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
import { relativeAge } from "./format";
import { useProfile } from "./hooks/useProfile";
import { ThresholdsProvider } from "./ThresholdsContext";
import { CalibrationPanel } from "./components/CalibrationPanel";
import "./App.css";

export default function App() {
  const [obs, setObs] = useState<Observation[]>([]);
  const [fc, setFc] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { profile, update, nudge } = useProfile();

  useEffect(() => {
    loadData().then(({ observations, forecasts }) => { setObs(observations); setFc(forecasts); setLoading(false); });
  }, []);

  useEffect(() => {
    const refresh = () => loadData().then(({ observations, forecasts }) => { setObs(observations); setFc(forecasts); });
    const poll = setInterval(refresh, 3 * 60 * 1000);
    const clock = setInterval(() => setNowMs(Date.now()), 30 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(poll); clearInterval(clock); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const latest = obs.length ? obs.reduce((a, b) => (a.time > b.time ? a : b)) : null;

  return (
    <ThresholdsProvider profile={profile}>
      <main>
        <header className="app-head">
          <div><div className="app-title">Barbed Wire Beach</div><div className="app-sub">Deer Creek Reservoir</div></div>
          {latest
            ? (() => {
                const ageMin = Math.round((nowMs - Date.parse(latest.time)) / 60000);
                return <span className={`asof${ageMin > 45 ? " stale" : ""}`}>
                  data as of {new Date(latest.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {relativeAge(latest.time, nowMs)}
                </span>;
              })()
            : <span className="asof">—</span>}
        </header>
        {loading ? <p>Loading…</p> : (
          <>
            <CollapsiblePanel id="now" title="Right now"><Verdict latest={latest} profile={profile} /></CollapsiblePanel>
            <CollapsiblePanel id="setup" title="Your setup"><CalibrationPanel profile={profile} update={update} nudge={nudge} /></CollapsiblePanel>
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
    </ThresholdsProvider>
  );
}
