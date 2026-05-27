import { useState, useEffect } from "react";
import type { Config } from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function useConfig() {
  const [config, setConfig] = useState<Config>({ skills: [] });
  const [skillsLoaded, setSkillsLoaded] = useState(false);

  // Fetch all skills and select them by default
  useEffect(() => {
    if (skillsLoaded) return;
    
    fetch(`${API_BASE}/api/skills`)
      .then(res => res.json())
      .then(data => {
        const allSkillNames = data.map((s: { name: string }) => s.name);
        setConfig({ skills: allSkillNames });
        setSkillsLoaded(true);
      })
      .catch(err => {
        console.error("Failed to load skills for default selection:", err);
        setSkillsLoaded(true);
      });
  }, [skillsLoaded]);

  const toggleSkill = (skillName: string) => {
    setConfig(prev => ({
      ...prev,
      skills: prev.skills?.includes(skillName)
        ? prev.skills.filter(s => s !== skillName)
        : [...(prev.skills || []), skillName],
    }));
  };

  return { config, toggleSkill };
}
