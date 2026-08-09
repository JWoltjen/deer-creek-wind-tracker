import { usePersistedState } from "../../hooks/usePersistedState";
import { sliceByRange, ridingHoursFilter, bandPoints, dailyBars, type Range, type HoursMode } from "../../chartData";
import type { Observation } from "../../types";
import { BandChart } from "./BandChart";
import { MonthBars } from "./MonthBars";

const RANGES: Range[] = ["day", "week", "month"];
const LABEL: Record<Range, string> = { day: "Day", week: "Week", month: "Month" };

export function HistoryChart({ observations, nowMs = Date.now() }: { observations: Observation[]; nowMs?: number }) {
  const [range, setRange] = usePersistedState<Range>("dc.chart.range", "week");
  const [hours, setHours] = usePersistedState<HoursMode>("dc.chart.hours", "riding");
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
