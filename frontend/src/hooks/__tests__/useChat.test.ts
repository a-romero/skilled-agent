import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useChat } from "../useChat";
import type { Config } from "../../types/api";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useChat", () => {
  const mockConfig: Config = {
    model: "gpt-4",
    temperature: 0.7,
    max_tokens: 2000,
    skills: ["search", "summarize"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("initializes with empty messages", () => {
    const { result } = renderHook(() => useChat(mockConfig));

    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("adds user message when sending", async () => {
    // Mock SSE response
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"kind":"say_start"}\n') })
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"kind":"say_chunk","text":"Hello"}\n') })
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"kind":"say_end"}\n') })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    });

    const { result } = renderHook(() => useChat(mockConfig));

    await act(async () => {
      result.current.sendMessage("Test question");
      // Advance timers for async processing
      await vi.advanceTimersByTimeAsync(100);
    });

    // Should have user message
    expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[0].text).toBe("Test question");
  });

  it("does not send empty messages", async () => {
    const { result } = renderHook(() => useChat(mockConfig));

    await act(async () => {
      result.current.sendMessage("   ");
    });

    expect(result.current.messages).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not send messages while loading", async () => {
    const mockReader = {
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    });

    const { result } = renderHook(() => useChat(mockConfig));

    // Start first message
    act(() => {
      result.current.sendMessage("First message");
    });

    // Try to send second message while first is loading
    await act(async () => {
      result.current.sendMessage("Second message");
      await vi.advanceTimersByTimeAsync(100);
    });

    // Should only have called fetch once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("handles network errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useChat(mockConfig));

    await act(async () => {
      result.current.sendMessage("Test question");
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.loading).toBe(false);
  });

  it("sends config with request", async () => {
    const mockReader = {
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    });

    const { result } = renderHook(() => useChat(mockConfig));

    await act(async () => {
      result.current.sendMessage("Test question");
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/chat"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining('"config"'),
      })
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.config.model).toBe(mockConfig.model);
    expect(callBody.config.temperature).toBe(mockConfig.temperature);
    expect(callBody.config.skills).toEqual(mockConfig.skills);
  });

  it("trims whitespace from messages", async () => {
    const mockReader = {
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    });

    const { result } = renderHook(() => useChat(mockConfig));

    await act(async () => {
      result.current.sendMessage("  Test with spaces  ");
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.messages[0].text).toBe("Test with spaces");
  });
});
