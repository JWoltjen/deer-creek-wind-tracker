import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the header after loading", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => "" })) as unknown as typeof fetch);
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Barbed Wire Beach/i)).toBeTruthy());
    expect(document.querySelector(".grid")).toBeTruthy();
  });

  it("refetches on an interval", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "" }) as any);
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await vi.runOnlyPendingTimersAsync();
    const initial = fetchMock.mock.calls.length; // 2 files on mount
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(initial);
    vi.useRealTimers();
  });
});
