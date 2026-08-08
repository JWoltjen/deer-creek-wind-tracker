import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ForecastVsActual } from "./ForecastVsActual";
import type { Observation, Forecast } from "../types";

const obs: Observation[] = [
  { time: "2026-08-08T14:00:00-06:00", tempF: 90, dir: "SW", low: 18, high: 22 },
];

const fc: Forecast[] = [
  {
    fetchedAt: "2026-08-07T18:00:00-06:00",
    source: "open-meteo",
    model: "ecmwf",
    validTime: "2026-08-08T14:00:00-06:00",
    windMph: 10,
    gustMph: null,
    dirDeg: 0,
  },
];

describe("ForecastVsActual", () => {
  it("Test A: empty state shows message", () => {
    render(<ForecastVsActual observations={[]} forecasts={[]} />);
    expect(screen.getByText(/No evaluated days yet/i)).toBeTruthy();
  });

  it("Test B: renders overlapping day and marks miss", () => {
    const { container } = render(<ForecastVsActual observations={obs} forecasts={fc} />);
    expect(screen.getByText("2026-08-08")).toBeTruthy();
    expect(container.querySelector("td.miss")).toBeTruthy();
  });

  it("Test C: no phantom column for non-overlapping day", () => {
    const phantomFc: Forecast[] = [
      ...fc,
      {
        fetchedAt: "2026-08-07T18:00:00-06:00",
        source: "nws",
        model: "nws",
        validTime: "2026-08-09T14:00:00-06:00",
        windMph: 12,
        gustMph: null,
        dirDeg: 0,
      },
    ];
    render(<ForecastVsActual observations={obs} forecasts={phantomFc} />);
    expect(screen.queryByText("nws/nws")).toBeNull();
    expect(screen.getByText("open-meteo/ecmwf")).toBeTruthy();
  });
});
