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
