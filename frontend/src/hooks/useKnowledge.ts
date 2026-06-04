import { useState, useEffect } from "react";
import type { KnowledgeTree } from "../types/api";
import { fetchJson } from "../utils/api";
import { useApiState } from "./useApiState";

export function useKnowledge() {
  const [tree, setTree] = useState<KnowledgeTree | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const { loading, error, setLoading, setError } = useApiState();

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchJson<KnowledgeTree>("/api/knowledge/tree")
      .then((data) => {
        setTree(data);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const toggleFolder = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectFile = (path: string) => {
    setSelectedPath(path);
  };

  return {
    tree,
    expanded,
    selectedPath,
    loading,
    error,
    toggleFolder,
    selectFile,
  };
}
