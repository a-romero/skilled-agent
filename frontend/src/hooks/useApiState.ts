/**
 * Reusable loading/error state management for API calls
 */
import { useState } from "react";

interface ApiState {
  loading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetError: () => void;
}

/**
 * Hook for managing loading and error state in API calls
 * 
 * @returns Object with loading/error state and setters
 */
export function useApiState(): ApiState {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const resetError = () => setError(null);

  return {
    loading,
    error,
    setLoading,
    setError,
    resetError,
  };
}
