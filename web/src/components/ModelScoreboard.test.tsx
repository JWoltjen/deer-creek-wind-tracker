import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ModelScoreboard } from "./ModelScoreboard";
import type { Forecast } from "../types";

const obs = [{ time: "2026-08-08T14:00:00-06:00", tempF: 90, dir: "SW", low: 18, high: 22 }];
const fc: Forecast[] = [
  { fetchedAt: "2026-08-07T18:00:00-06:00", source: "nws", model: "nws",
    validTime: "2026-08-08T14:00:00-06:00", windMph: 10, gustMph: null, dirDeg: 225 },
];

describe("ModelScoreboard", () => {
  it("empty when no overlap", () => {
    render(<ModelScoreboard observations={[]} forecasts={[]} />);
    expect(screen.getByText(/No overlapping days yet/i)).toBeTruthy();
  });
  it("lists a model row", () => {
    render(<ModelScoreboard observations={obs} forecasts={fc} />);
    expect(screen.getByText(/nws\/nws/)).toBeTruthy();
  });
});
