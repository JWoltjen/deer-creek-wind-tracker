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
