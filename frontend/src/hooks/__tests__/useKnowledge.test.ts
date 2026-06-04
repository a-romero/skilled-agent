import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useKnowledge } from "../useKnowledge";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useKnowledge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches knowledge tree on mount", async () => {
    const mockTree = {
      brand: "Test Brand",
      root: ".",
      children: [
        { name: "folder1", path: "folder1", type: "directory", children: [] },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTree,
    });

    const { result } = renderHook(() => useKnowledge());

    expect(result.current.loading).toBe(true);
    expect(result.current.tree).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tree).toEqual(mockTree);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/knowledge/tree")
    );
  });

  it("handles fetch errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useKnowledge());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tree).toBeNull();
    expect(result.current.error).toBe("Network error");
  });

  it("toggles folder expansion", async () => {
    const mockTree = {
      brand: "Test",
      root: ".",
      children: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTree,
    });

    const { result } = renderHook(() => useKnowledge());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const path = "folder/subfolder";

    // Initially not expanded
    expect(result.current.expanded.has(path)).toBe(false);

    // Toggle to expand
    act(() => {
      result.current.toggleFolder(path);
    });

    expect(result.current.expanded.has(path)).toBe(true);

    // Toggle to collapse
    act(() => {
      result.current.toggleFolder(path);
    });

    expect(result.current.expanded.has(path)).toBe(false);
  });

  it("selects file", async () => {
    const mockTree = {
      brand: "Test",
      root: ".",
      children: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTree,
    });

    const { result } = renderHook(() => useKnowledge());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const path = "folder/file.md";

    expect(result.current.selectedPath).toBeNull();

    act(() => {
      result.current.selectFile(path);
    });

    expect(result.current.selectedPath).toBe(path);
  });

  it("initializes with empty expanded set", async () => {
    const mockTree = {
      brand: "Test",
      root: ".",
      children: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockTree,
    });

    const { result } = renderHook(() => useKnowledge());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.expanded).toBeInstanceOf(Set);
    expect(result.current.expanded.size).toBe(0);
  });
});
