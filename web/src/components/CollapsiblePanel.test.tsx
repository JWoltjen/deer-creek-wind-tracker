import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { CollapsiblePanel } from "./CollapsiblePanel";

describe("CollapsiblePanel", () => {
  beforeEach(() => localStorage.clear());
  it("starts expanded, shows title + body", () => {
    render(<CollapsiblePanel id="x" title="History"><p>body</p></CollapsiblePanel>);
    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });
  it("collapses on click and persists", () => {
    const { unmount } = render(<CollapsiblePanel id="x" title="History"><p>body</p></CollapsiblePanel>);
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    expect(screen.queryByText("body")).toBeNull();
    unmount();
    render(<CollapsiblePanel id="x" title="History"><p>body</p></CollapsiblePanel>);
    expect(screen.queryByText("body")).toBeNull(); // restored collapsed
  });
});
