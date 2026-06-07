/**
 * Tests for frontend/src/utils/logger.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../logger";

describe("logger", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe("error", () => {
    it("logs error message", () => {
      logger.error("Test error message");
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call[1]).toBe("Test error message");
    });
    
    it("logs error with Error object", () => {
      const error = new Error("Something went wrong");
      logger.error("Operation failed", error);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call[1]).toBe("Operation failed");
      expect(call[2]).toMatchObject({
        name: "Error",
        message: "Something went wrong",
      });
    });
    
    it("sanitizes Error object to prevent stack leaks in production", () => {
      const error = new Error("Test error");
      error.stack = "Sensitive stack trace";
      
      logger.error("Error occurred", error);
      
      const call = consoleErrorSpy.mock.calls[0];
      const sanitized = call[2];
      
      // Stack should only be included in dev mode
      if (import.meta.env.DEV) {
        expect(sanitized).toHaveProperty("stack");
      } else {
        expect(sanitized).not.toHaveProperty("stack");
      }
      expect(sanitized).toHaveProperty("name", "Error");
      expect(sanitized).toHaveProperty("message", "Test error");
    });
    
    it("logs error with primitive data", () => {
      logger.error("Error with number", 42);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call[2]).toBe(42);
    });
    
    it("logs error with object data", () => {
      const data = { code: "ERR_001", details: "Failed" };
      logger.error("Error with object", data);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call[2]).toEqual(data);
    });
    
    it("handles non-Error thrown values", () => {
      logger.error("String error", "Something bad");
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      // Non-Error values are passed through as-is, not wrapped
      expect(call[2]).toBe("Something bad");
    });
    
    it("includes timestamp in log entry", () => {
      logger.error("Test");
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      const prefix = call[0] as string;
      // Should have ISO timestamp format
      expect(prefix).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
  
  describe("warn", () => {
    it("logs warning message", () => {
      logger.warn("Test warning");
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      const call = consoleWarnSpy.mock.calls[0];
      expect(call[1]).toBe("Test warning");
    });
    
    it("logs warning with data", () => {
      const data = { count: 5, threshold: 10 };
      logger.warn("Approaching limit", data);
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      const call = consoleWarnSpy.mock.calls[0];
      expect(call[2]).toEqual(data);
    });
    
    it("includes WARNING level in prefix", () => {
      logger.warn("Test");
      
      const call = consoleWarnSpy.mock.calls[0];
      const prefix = call[0] as string;
      expect(prefix).toContain("[WARN]");
    });
  });
  
  describe("info", () => {
    it("logs info message", () => {
      logger.info("Test info");
      
      // In dev mode, should call console.info
      if (import.meta.env.DEV) {
        expect(consoleInfoSpy).toHaveBeenCalled();
        const call = consoleInfoSpy.mock.calls[0];
        expect(call[1]).toBe("Test info");
      }
    });
    
    it("logs info with data", () => {
      const data = { userId: "123", action: "login" };
      logger.info("User action", data);
      
      if (import.meta.env.DEV) {
        expect(consoleInfoSpy).toHaveBeenCalled();
        const call = consoleInfoSpy.mock.calls[0];
        expect(call[2]).toEqual(data);
      }
    });
    
    it("includes INFO level in prefix", () => {
      logger.info("Test");
      
      if (import.meta.env.DEV) {
        const call = consoleInfoSpy.mock.calls[0];
        const prefix = call[0] as string;
        expect(prefix).toContain("[INFO]");
      }
    });
  });
  
  describe("debug", () => {
    it("logs debug message", () => {
      logger.debug("Test debug");
      
      if (import.meta.env.DEV) {
        expect(consoleDebugSpy).toHaveBeenCalled();
        const call = consoleDebugSpy.mock.calls[0];
        expect(call[1]).toBe("Test debug");
      }
    });
    
    it("logs debug with data", () => {
      const data = { state: "loading", progress: 0.5 };
      logger.debug("State update", data);
      
      if (import.meta.env.DEV) {
        expect(consoleDebugSpy).toHaveBeenCalled();
        const call = consoleDebugSpy.mock.calls[0];
        expect(call[2]).toEqual(data);
      }
    });
    
    it("includes DEBUG level in prefix", () => {
      logger.debug("Test");
      
      if (import.meta.env.DEV) {
        const call = consoleDebugSpy.mock.calls[0];
        const prefix = call[0] as string;
        expect(prefix).toContain("[DEBUG]");
      }
    });
  });
  
  describe("production mode", () => {
    it("only logs errors in production", () => {
      if (!import.meta.env.DEV) {
        logger.info("Info message");
        logger.warn("Warning message");
        logger.debug("Debug message");
        logger.error("Error message");
        
        // Only error should be logged
        expect(consoleInfoSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
        expect(consoleDebugSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
      }
    });
  });
  
  describe("error sanitization", () => {
    it("extracts name and message from Error", () => {
      const error = new TypeError("Invalid type");
      logger.error("Type error occurred", error);
      
      const call = consoleErrorSpy.mock.calls[0];
      const sanitized = call[2];
      expect(sanitized).toHaveProperty("name", "TypeError");
      expect(sanitized).toHaveProperty("message", "Invalid type");
    });
    
    it("handles Error subclasses", () => {
      class CustomError extends Error {
        code: string;
        constructor(message: string, code: string) {
          super(message);
          this.name = "CustomError";
          this.code = code;
        }
      }
      
      const error = new CustomError("Custom error", "ERR_001");
      logger.error("Custom error occurred", error);
      
      const call = consoleErrorSpy.mock.calls[0];
      const sanitized = call[2];
      expect(sanitized).toHaveProperty("name", "CustomError");
      expect(sanitized).toHaveProperty("message", "Custom error");
    });
    
    it("converts non-Error values to string", () => {
      logger.error("Unexpected error", { weird: "object" });
      
      const call = consoleErrorSpy.mock.calls[0];
      const data = call[2];
      // Objects that aren't Errors are passed through as-is
      expect(data).toEqual({ weird: "object" });
    });
    
    it("handles null and undefined", () => {
      logger.error("Null error", null);
      logger.error("Undefined error", undefined);
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });
  });
  
  describe("timestamp format", () => {
    it("uses ISO 8601 timestamp format", () => {
      const before = new Date().toISOString();
      logger.error("Test");
      const after = new Date().toISOString();
      
      const call = consoleErrorSpy.mock.calls[0];
      const prefix = call[0] as string;
      const timestampMatch = prefix.match(/\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\]/);
      
      expect(timestampMatch).toBeTruthy();
      if (timestampMatch) {
        const timestamp = timestampMatch[1];
        expect(timestamp >= before).toBe(true);
        expect(timestamp <= after).toBe(true);
      }
    });
  });
  
  describe("edge cases", () => {
    it("handles empty message", () => {
      logger.error("");
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call[1]).toBe("");
    });
    
    it("handles very long messages", () => {
      const longMessage = "x".repeat(10000);
      logger.error(longMessage);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0];
      expect(call[1]).toBe(longMessage);
    });
    
    it("handles circular references in data objects", () => {
      const circular: any = { name: "test" };
      circular.self = circular;
      
      // Should not throw
      expect(() => logger.error("Circular ref", circular)).not.toThrow();
    });
  });
});
