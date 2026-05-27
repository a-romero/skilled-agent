import { useState } from "react";
import type { Config } from "../types/api";

const DEFAULT_CONFIG: Config = {
  skills: [],
};

export function useConfig() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);

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
