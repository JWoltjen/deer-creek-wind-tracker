import { useState } from "react";
import { usePersistedState } from "../../hooks/usePersistedState";
import {
  sliceByRange, sliceByDay, ridingHoursFilter, bandPoints, dailyBars, timeInWindow,
  dataDayRange, localDateStr, addDays, type Range, type HoursMode,
} from "../../chartData";
import { formatDuration, formatDayLabel } from "../../format";
import { config } from "../../config";
import type { Observation } from "../../types";
import { BandChart } from "./BandChart";
import { MonthBars } from "./MonthBars";
import { useThresholds } from "../../ThresholdsContext";

const RANGES: Range[] = ["day", "week", "month"];
const LABEL: Record<Range, string> = { day: "Day", week: "Week", month: "Month" };

export function HistoryChart({ observations, nowMs = Date.now() }: { observations: Observation[]; nowMs?: number }) {
  const t = useThresholds();
  const [range, setRange] = usePersistedState<Range>("dc.chart.range", "week");
  const [hours, setHours] = usePersistedState<HoursMode>("dc.chart.hours", "riding");
  const [inWindow, setInWindow] = usePersistedState<boolean>("dc.chart.inWindow", false);
  const today = localDateStr(nowMs);
  const [selectedDay, setSelectedDay] = useState(today);

  const isDay = range === "day";
  const dr = dataDayRange(observations);
  const firstDay = dr ? dr.first : today;
  const sliced = isDay ? sliceByDay(observations, selectedDay) : sliceByRange(observations, range, nowMs);
  const mins = timeInWindow(sliced, t, config.ridingStartHour, config.ridingEndHour);
  const dayWindow = isDay
    ? (hours === "full"
        ? { startHour: 0, endHour: 24 }
        : { startHour: config.ridingStartHour, endHour: config.ridingEndHour + 1 })
    : undefined;

  return (
    <div className="history">
      <div className="history-head">
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
        <button className={`seg inwin${inWindow ? " on" : ""}`} onClick={() => setInWindow(!inWindow)} title="time in your range">
          ◑ in-window · {formatDuration(mins)}
        </button>
      </div>
      {isDay && (
        <div className="day-stepper">
          <button className="day-nav" aria-label="previous day" disabled={selectedDay <= firstDay}
            onClick={() => setSelectedDay(addDays(selectedDay, -1))}>‹</button>
          <span className="day-label">{selectedDay === today ? "Today" : formatDayLabel(selectedDay)}</span>
          <button className="day-nav" aria-label="next day" disabled={selectedDay >= today}
            onClick={() => setSelectedDay(addDays(selectedDay, 1))}>›</button>
        </div>
      )}
      {range === "month"
        ? <MonthBars bars={dailyBars(sliced, hours, t)} />
        : <BandChart points={bandPoints(ridingHoursFilter(sliced, hours), t)}
            showDayLabels={range === "week"} inWindow={inWindow} dayWindow={dayWindow} />}
    </div>
  );
}
