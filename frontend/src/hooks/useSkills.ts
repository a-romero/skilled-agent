import { useState, useEffect } from "react";
import type { Skill } from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/skills`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => setSkills(data))
      .catch(err => {
        console.error("Failed to load skills:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return { skills, loading, error };
}
