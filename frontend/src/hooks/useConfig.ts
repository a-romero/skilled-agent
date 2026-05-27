import { useState } from "react";
import type { Config } from "../types/api";

const DEFAULT_CONFIG: Config = {
  model: "anthropic/claude-sonnet-4",
  temperature: 0.7,
  max_tokens: 8192,
  skills: [],
};

export function useConfig() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);

  const updateConfig = (partial: Partial<Config>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  };

  const toggleSkill = (skillName: string) => {
    setConfig(prev => ({
      ...prev,
      skills: prev.skills?.includes(skillName)
        ? prev.skills.filter(s => s !== skillName)
        : [...(prev.skills || []), skillName],
    }));
  };

  return { config, updateConfig, toggleSkill };
}
