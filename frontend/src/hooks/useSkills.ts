import { useState, useEffect } from "react";
import type { Skill } from "../types/api";
import { fetchJson } from "../utils/api";
import { useApiState } from "./useApiState";

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const { loading, error, setLoading, setError } = useApiState();

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchJson<Skill[]>("/api/skills")
      .then((data) => {
        setSkills(data);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setLoading, setError]);

  return { skills, loading, error };
}
