/**
 * Structured logging utility
 * 
 * Provides consistent logging interface across the application.
 * In development: logs to console with formatting
 * In production: could send to monitoring service (future enhancement)
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

function sanitizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      // Don't include stack in production to avoid leaking sensitive info
      ...(import.meta.env.DEV && { stack: error.stack }),
    };
  }
  return { error: String(error) };
}

function log(level: LogLevel, message: string, data?: unknown): void {
  const entry: LogEntry = {
    level,
    message,
    data: data !== undefined ? (data instanceof Error ? sanitizeError(data) : data) : undefined,
    timestamp: new Date().toISOString(),
  };

  // In development, log to console with nice formatting
  if (import.meta.env.DEV) {
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
    switch (level) {
      case "error":
        console.error(prefix, message, entry.data || "");
        break;
      case "warn":
        console.warn(prefix, message, entry.data || "");
        break;
      case "info":
        console.info(prefix, message, entry.data || "");
        break;
      case "debug":
        console.debug(prefix, message, entry.data || "");
        break;
    }
  } else {
    // In production, only log errors to console
    // Future: send to monitoring service
    if (level === "error") {
      console.error(message, entry.data);
    }
  }
}

export const logger = {
  error: (message: string, error?: unknown) => log("error", message, error),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  info: (message: string, data?: unknown) => log("info", message, data),
  debug: (message: string, data?: unknown) => log("debug", message, data),
};
