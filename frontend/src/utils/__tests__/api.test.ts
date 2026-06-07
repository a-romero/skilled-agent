/**
 * Tests for frontend/src/utils/api.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchJson, ApiError } from "../api";
import { API_BASE } from "../../config/api";

describe("ApiError", () => {
  it("creates error with status and statusText", () => {
    const error = new ApiError("Test error", 404, "Not Found");
    
    expect(error.message).toBe("Test error");
    expect(error.status).toBe(404);
    expect(error.statusText).toBe("Not Found");
    expect(error.name).toBe("ApiError");
  });
  
  it("is an instance of Error", () => {
    const error = new ApiError("Test", 500, "Server Error");
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
  });
});

describe("fetchJson", () => {
  const mockFetch = vi.fn();
  
  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockClear();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it("fetches data from API endpoint", async () => {
    const mockData = { name: "test", value: 42 };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });
    
    const result = await fetchJson("/api/test");
    
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/test`, undefined);
    expect(result).toEqual(mockData);
  });
  
  it("passes options to fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "value" }),
    };
    
    await fetchJson("/api/test", options);
    
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/test`, options);
  });
  
  it("returns typed response", async () => {
    interface TestData {
      id: number;
      name: string;
    }
    
    const mockData: TestData = { id: 1, name: "test" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });
    
    const result = await fetchJson<TestData>("/api/test");
    
    expect(result.id).toBe(1);
    expect(result.name).toBe("test");
  });
  
  it("throws ApiError on HTTP 404", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    
    await expect(fetchJson("/api/missing")).rejects.toThrow(ApiError);
    
    try {
      await fetchJson("/api/missing");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(404);
      expect(apiError.statusText).toBe("Not Found");
      expect(apiError.message).toContain("Failed to fetch /api/missing");
    }
  });
  
  it("throws ApiError on HTTP 500", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });
    
    await expect(fetchJson("/api/error")).rejects.toThrow(ApiError);
    
    try {
      await fetchJson("/api/error");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.status).toBe(500);
      expect(apiError.statusText).toBe("Internal Server Error");
    }
  });
  
  it("throws ApiError on HTTP 403", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });
    
    await expect(fetchJson("/api/forbidden")).rejects.toThrow(ApiError);
    
    try {
      await fetchJson("/api/forbidden");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.status).toBe(403);
    }
  });
  
  it("throws ApiError on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network request failed"));
    
    await expect(fetchJson("/api/test")).rejects.toThrow(ApiError);
    
    try {
      await fetchJson("/api/test");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.status).toBe(0);
      expect(apiError.statusText).toBe("Network Error");
      expect(apiError.message).toContain("Network error");
      expect(apiError.message).toContain("Network request failed");
    }
  });
  
  it("throws ApiError on malformed JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });
    
    await expect(fetchJson("/api/test")).rejects.toThrow(ApiError);
    
    try {
      await fetchJson("/api/test");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.status).toBe(0);
      expect(apiError.statusText).toBe("Network Error");
      expect(apiError.message).toContain("Unexpected token");
    }
  });
  
  it("throws ApiError when fetch rejects with non-Error object", async () => {
    mockFetch.mockRejectedValue("String error");
    
    await expect(fetchJson("/api/test")).rejects.toThrow(ApiError);
    
    try {
      await fetchJson("/api/test");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.message).toContain("String error");
    }
  });
  
  it("handles empty response body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => null,
    });
    
    const result = await fetchJson("/api/test");
    
    expect(result).toBeNull();
  });
  
  it("handles array response", async () => {
    const mockArray = [{ id: 1 }, { id: 2 }, { id: 3 }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockArray,
    });
    
    const result = await fetchJson<Array<{ id: number }>>("/api/list");
    
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
  });
  
  it("constructs correct URL with API_BASE", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    
    await fetchJson("/api/test");
    
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe(`${API_BASE}/api/test`);
  });
  
  it("preserves original ApiError when re-throwing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });
    
    try {
      await fetchJson("/api/secure");
    } catch (error) {
      // Should be the same ApiError instance, not wrapped
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(401);
      expect(apiError.message).toContain("Failed to fetch");
    }
  });
  
  it("handles timeout errors", async () => {
    const timeoutError = new Error("The user aborted a request");
    timeoutError.name = "AbortError";
    mockFetch.mockRejectedValue(timeoutError);
    
    await expect(fetchJson("/api/slow")).rejects.toThrow(ApiError);
    
    try {
      await fetchJson("/api/slow");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.message).toContain("The user aborted a request");
    }
  });
  
  it("handles CORS errors", async () => {
    // CORS errors typically manifest as TypeError with specific message
    const corsError = new TypeError("Failed to fetch");
    mockFetch.mockRejectedValue(corsError);
    
    await expect(fetchJson("/api/cors")).rejects.toThrow(ApiError);
    
    try {
      await fetchJson("/api/cors");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.statusText).toBe("Network Error");
      expect(apiError.status).toBe(0);
    }
  });
  
  it("handles response with status 0 (network offline)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 0,
      statusText: "",
    });
    
    await expect(fetchJson("/api/offline")).rejects.toThrow(ApiError);
    
    try {
      await fetchJson("/api/offline");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.status).toBe(0);
    }
  });
});
