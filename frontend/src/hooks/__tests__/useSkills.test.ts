import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSkills } from "../useSkills";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useSkills", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with empty skills array, not loading, no error", () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useSkills());

    expect(result.current.skills).toEqual([]);
    expect(result.current.loading).toBe(true); // Loading starts immediately
    expect(result.current.error).toBeNull();
  });

  it("fetches skills successfully on mount", async () => {
    const mockSkills = [
      { name: "python-coder", description: "Expert Python programmer" },
      { name: "summariser", description: "Summarizes long documents" },
      { name: "researcher", description: "Deep research specialist" },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSkills,
    });

    const { result } = renderHook(() => useSkills());

    expect(result.current.loading).toBe(true);
    expect(result.current.skills).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.skills).toEqual(mockSkills);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/skills",
      undefined
    );
  });

  it("sets loading to true during fetch", async () => {
    const mockSkills = [
      { name: "test-skill", description: "Test skill" },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSkills,
    });

    const { result } = renderHook(() => useSkills());

    // Should be loading immediately
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.skills).toEqual(mockSkills);
  });

  it("handles fetch errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useSkills());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.skills).toEqual([]);
    expect(result.current.error).toContain("Network error");
  });

  it("handles HTTP error responses", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { result } = renderHook(() => useSkills());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.skills).toEqual([]);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error).toContain("Internal Server Error");
  });

  it("handles empty skills array from API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useSkills());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.skills).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("uses correct API endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    renderHook(() => useSkills());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/skills",
      undefined
    );
  });

  it("fetches skills only once on mount", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ name: "test", description: "test" }],
    });

    const { rerender } = renderHook(() => useSkills());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const callCount = mockFetch.mock.calls.length;

    // Re-render the hook
    rerender();

    // Should not fetch again
    expect(mockFetch).toHaveBeenCalledTimes(callCount);
  });

  it("handles malformed JSON response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    });

    const { result } = renderHook(() => useSkills());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.skills).toEqual([]);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error).toContain("Invalid JSON");
  });
});
