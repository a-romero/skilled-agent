import { useState, useEffect } from "react";
import type { KnowledgeTree } from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function useKnowledge() {
  const [tree, setTree] = useState<KnowledgeTree | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/knowledge/tree`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load knowledge tree: ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        setTree(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load knowledge tree:", err);
        setError(err.message);
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
