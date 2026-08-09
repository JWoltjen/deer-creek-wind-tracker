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
});
