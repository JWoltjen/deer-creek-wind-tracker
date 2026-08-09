import { classify } from "../classify";
import { categoryColor } from "../theme";
import { toCsv } from "../csv";
import { useThresholds } from "../ThresholdsContext";
import type { Observation } from "../types";

export function RecentReadings({ observations }: { observations: Observation[] }) {
  const t = useThresholds();
  if (observations.length === 0) return <div className="recent"><p>No readings yet</p></div>;
  const sorted = [...observations].sort((a, b) => (a.time < b.time ? 1 : -1));
  const download = () => {
    const blob = new Blob([toCsv(sorted)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "barbed-wire-readings.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="recent">
      <div className="recent-head">
        <button className="csv-btn" onClick={download}>⬇ CSV</button>
      </div>
      <div className="recent-rows">
        {sorted.slice(0, 8).map((o, i) => {
          const cat = classify(o.low, o.high, t);
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
    </div>
  );
}
