import { useState, useEffect } from "react";
import type { Config } from "../types/api";
import { fetchJson } from "../utils/api";
import { logger } from "../utils/logger";

export function useConfig() {
  const [config, setConfig] = useState<Config>({
    llmModel: "",
    llmProvider: "",
    thinkingEnabled: false,
  });

  useEffect(() => {
    fetchJson<{ llm_model: string; llm_provider: string }>("/api/config")
      .then((data) => {
        setConfig({
          llmModel: data.llm_model || "",
          llmProvider: data.llm_provider || "",
          thinkingEnabled: false,
        });
      })
      .catch((err) => {
        logger.error("Failed to load config", err);
      });
  }, []);

  const setThinkingEnabled = (enabled: boolean) => {
    setConfig((prev) => ({ ...prev, thinkingEnabled: enabled }));
  };

  return { config, setThinkingEnabled };
}
