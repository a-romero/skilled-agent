/**
 * API fetch utilities
 */
import { logger } from "./logger";
import { API_BASE } from "../config/api";

export class ApiError extends Error {
  status: number;
  statusText: string;

  constructor(
    message: string,
    status: number,
    statusText: string
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
  }
}

/**
 * Fetch JSON data from API endpoint with error handling
 * 
 * @param endpoint - API endpoint path (e.g., "/api/skills")
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws ApiError if request fails
 */
export async function fetchJson<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = new ApiError(
        `Failed to fetch ${endpoint}: ${response.statusText}`,
        response.status,
        response.statusText
      );
      logger.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
    
    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network error or JSON parse error
    logger.error(`API request error: ${endpoint}`, error);
    throw new ApiError(
      `Network error: ${error instanceof Error ? error.message : String(error)}`,
      0,
      "Network Error"
    );
  }
}
