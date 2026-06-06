/**
 * Tests for frontend/src/hooks/useApiState.ts
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useApiState } from "../useApiState";

describe("useApiState", () => {
  it("initializes with loading false and no error", () => {
    const { result } = renderHook(() => useApiState());
    
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
  
  it("provides setLoading function", () => {
    const { result } = renderHook(() => useApiState());
    
    expect(typeof result.current.setLoading).toBe("function");
  });
  
  it("provides setError function", () => {
    const { result } = renderHook(() => useApiState());
    
    expect(typeof result.current.setError).toBe("function");
  });
  
  it("provides resetError function", () => {
    const { result } = renderHook(() => useApiState());
    
    expect(typeof result.current.resetError).toBe("function");
  });
  
  it("updates loading state when setLoading is called", () => {
    const { result } = renderHook(() => useApiState());
    
    act(() => {
      result.current.setLoading(true);
    });
    
    expect(result.current.loading).toBe(true);
    
    act(() => {
      result.current.setLoading(false);
    });
    
    expect(result.current.loading).toBe(false);
  });
  
  it("updates error state when setError is called", () => {
    const { result } = renderHook(() => useApiState());
    
    act(() => {
      result.current.setError("Network error");
    });
    
    expect(result.current.error).toBe("Network error");
  });
  
  it("clears error when resetError is called", () => {
    const { result } = renderHook(() => useApiState());
    
    act(() => {
      result.current.setError("Something went wrong");
    });
    
    expect(result.current.error).toBe("Something went wrong");
    
    act(() => {
      result.current.resetError();
    });
    
    expect(result.current.error).toBeNull();
  });
  
  it("can set error to null directly with setError", () => {
    const { result } = renderHook(() => useApiState());
    
    act(() => {
      result.current.setError("Error message");
    });
    
    expect(result.current.error).toBe("Error message");
    
    act(() => {
      result.current.setError(null);
    });
    
    expect(result.current.error).toBeNull();
  });
  
  it("maintains independent loading and error states", () => {
    const { result } = renderHook(() => useApiState());
    
    act(() => {
      result.current.setLoading(true);
      result.current.setError("Error occurred");
    });
    
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe("Error occurred");
    
    act(() => {
      result.current.setLoading(false);
    });
    
    // Error should remain even after loading is cleared
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("Error occurred");
  });
  
  it("can set loading multiple times", () => {
    const { result } = renderHook(() => useApiState());
    
    act(() => {
      result.current.setLoading(true);
    });
    expect(result.current.loading).toBe(true);
    
    act(() => {
      result.current.setLoading(false);
    });
    expect(result.current.loading).toBe(false);
    
    act(() => {
      result.current.setLoading(true);
    });
    expect(result.current.loading).toBe(true);
  });
  
  it("can update error multiple times", () => {
    const { result } = renderHook(() => useApiState());
    
    act(() => {
      result.current.setError("First error");
    });
    expect(result.current.error).toBe("First error");
    
    act(() => {
      result.current.setError("Second error");
    });
    expect(result.current.error).toBe("Second error");
  });
  
  it("resetError works multiple times", () => {
    const { result } = renderHook(() => useApiState());
    
    act(() => {
      result.current.setError("Error 1");
      result.current.resetError();
    });
    expect(result.current.error).toBeNull();
    
    act(() => {
      result.current.setError("Error 2");
      result.current.resetError();
    });
    expect(result.current.error).toBeNull();
  });
  
  it("resetError is stable across renders", () => {
    const { result, rerender } = renderHook(() => useApiState());
    
    const firstResetError = result.current.resetError;
    
    rerender();
    
    const secondResetError = result.current.resetError;
    
    // resetError should be the same function reference (useCallback)
    expect(firstResetError).toBe(secondResetError);
  });
  
  it("supports typical API request lifecycle", () => {
    const { result } = renderHook(() => useApiState());
    
    // Start request
    act(() => {
      result.current.setLoading(true);
      result.current.setError(null);
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    
    // Request fails
    act(() => {
      result.current.setLoading(false);
      result.current.setError("Request failed");
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("Request failed");
    
    // Retry request
    act(() => {
      result.current.setLoading(true);
      result.current.resetError();
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    
    // Request succeeds
    act(() => {
      result.current.setLoading(false);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
  
  it("handles concurrent state updates", () => {
    const { result } = renderHook(() => useApiState());
    
    act(() => {
      result.current.setLoading(true);
      result.current.setError("Error");
      result.current.setLoading(false);
      result.current.resetError();
    });
    
    // Final state should reflect last updates
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
  
  it("returns all five expected properties", () => {
    const { result } = renderHook(() => useApiState());
    
    expect(Object.keys(result.current)).toEqual([
      "loading",
      "error",
      "setLoading",
      "setError",
      "resetError",
    ]);
  });
  
  it("handles empty error message", () => {
    const { result } = renderHook(() => useApiState());
    
    act(() => {
      result.current.setError("");
    });
    
    expect(result.current.error).toBe("");
  });
  
  it("handles very long error messages", () => {
    const { result } = renderHook(() => useApiState());
    const longError = "Error: " + "x".repeat(1000);
    
    act(() => {
      result.current.setError(longError);
    });
    
    expect(result.current.error).toBe(longError);
  });
  
  describe("multiple instances", () => {
    it("maintains independent state across multiple hook instances", () => {
      const { result: result1 } = renderHook(() => useApiState());
      const { result: result2 } = renderHook(() => useApiState());
      
      act(() => {
        result1.current.setLoading(true);
        result1.current.setError("Error 1");
      });
      
      act(() => {
        result2.current.setLoading(false);
        result2.current.setError("Error 2");
      });
      
      expect(result1.current.loading).toBe(true);
      expect(result1.current.error).toBe("Error 1");
      expect(result2.current.loading).toBe(false);
      expect(result2.current.error).toBe("Error 2");
    });
  });
});
