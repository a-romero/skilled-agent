import { useState, useEffect } from "react";
import type { Config } from "../types/api";
import { fetchJson } from "../utils/api";
import { logger } from "../utils/logger";

interface RuntimeConfig {
  model: string;
  provider: string;
  user: string;
  org: string;
}

export function useConfig() {
  const [config, setConfig] = useState<Config>({ skills: [] });
  const [skillsLoaded, setSkillsLoaded] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);

  // Fetch runtime config (model, provider, user, org) from backend
  useEffect(() => {
    fetchJson<RuntimeConfig>("/api/config")
      .then((data) => {
        setRuntimeConfig(data);
      })
      .catch((err) => {
        logger.error("Failed to load runtime config", err);
      });
  }, []);

  // Fetch all skills and select them by default
  useEffect(() => {
    if (skillsLoaded) return;
    
    fetchJson<{ name: string; description: string }[]>("/api/skills")
      .then((data) => {
        const allSkillNames = data.map((s) => s.name);
        setConfig({ skills: allSkillNames });
        setSkillsLoaded(true);
      })
      .catch((err) => {
        logger.error("Failed to load skills for default selection", err);
        setSkillsLoaded(true);
      });
  }, [skillsLoaded]);

  const toggleSkill = (skillName: string) => {
    setConfig((prev) => ({
      ...prev,
      skills: prev.skills?.includes(skillName)
        ? prev.skills.filter((s) => s !== skillName)
        : [...(prev.skills || []), skillName],
    }));
  };

  return { config, toggleSkill, runtimeConfig };
}
