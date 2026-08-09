import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistedState } from "./usePersistedState";

describe("usePersistedState", () => {
  beforeEach(() => localStorage.clear());
  it("returns the initial value when nothing stored", () => {
    const { result } = renderHook(() => usePersistedState("k", "def"));
    expect(result.current[0]).toBe("def");
  });
  it("persists and restores across mounts", () => {
    const a = renderHook(() => usePersistedState("k", "def"));
    act(() => a.result.current[1]("changed"));
    expect(localStorage.getItem("k")).toBe(JSON.stringify("changed"));
    const b = renderHook(() => usePersistedState("k", "def"));
    expect(b.result.current[0]).toBe("changed");
  });
});
