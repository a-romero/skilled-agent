import React, { useState, useEffect } from "react";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { Icon } from "../shared/Icon";
import type { Frontmatter, KnowledgeNode, KnowledgeTree } from "../../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface FileData {
  path: string;
  frontmatter: Frontmatter;
  body: string;
}

interface FilePreviewProps {
  path: string | null;
  tree: KnowledgeTree | null;
  onBack: () => void;
}

// Helper to resolve a path within the tree structure for SUMMARY.MD synthetic files
function resolveSummaryNode(
  path: string,
  tree: KnowledgeTree | null
): { summary: string; children: KnowledgeNode[]; name: string } | null {
  if (!tree) return null;

  // Root SUMMARY.MD
  if (path === "SUMMARY.MD") {
    return {
      summary: tree.root.summary,
      children: tree.root.children,
      name: "Knowledge",
    };
  }

  // Directory SUMMARY.MD
  if (path.endsWith("/SUMMARY.MD")) {
    const dirPath = path.replace(/\/SUMMARY\.MD$/, "");
    const parts = dirPath.split("/").filter(Boolean);
    
    let current: KnowledgeNode[] = tree.root.children;
    let node: KnowledgeNode | undefined;
    
    for (const part of parts) {
      node = current.find((n) => n.name === part);
      if (!node || node.type !== "dir") return null;
      current = node.children || [];
    }

    if (node && node.type === "dir") {
      return {
        summary: node.summary || "",
        children: node.children || [],
        name: node.name,
      };
    }
  }

  return null;
}

const FrontmatterView: React.FC<{ fm: Frontmatter }> = ({ fm }) => {
  return (
    <div className="kfrontmatter">
      <div className="fm-row">
        <span className="fm-k">url</span>: <span className="fm-v">{fm.url}</span>
      </div>
      <div className="fm-row">
        <span className="fm-k">title</span>: <span className="fm-v">"{fm.title}"</span>
      </div>
      <div className="fm-row">
        <span className="fm-k">summary</span>: <span className="fm-v">"{fm.summary}"</span>
      </div>
      <div className="fm-row" style={{ marginTop: 6 }}>
        <span className="fm-k">topics</span>:
        <div className="kchips" style={{ marginTop: 3 }}>
          {fm.topics.map((t) => (
            <span key={t} className="kchip topic">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="fm-row" style={{ marginTop: 6 }}>
        <span className="fm-k">keywords</span>:
        <div className="kchips" style={{ marginTop: 3 }}>
          {fm.keywords.map((k) => (
            <span key={k} className="kchip">
              {k}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export const FilePreview: React.FC<FilePreviewProps> = ({ path, tree, onBack }) => {
  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setFile(null);
      setError(null);
      return;
    }

    // Check if this is a synthetic SUMMARY.MD
    if (path.endsWith("SUMMARY.MD")) {
      const summaryNode = resolveSummaryNode(path, tree);
      if (summaryNode) {
        setFile(null);
        setError(null);
        return; // We'll render this separately below
      }
    }

    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/knowledge/file?path=${encodeURIComponent(path)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load file: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        setFile(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading file:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [path, tree]);

  if (!path) {
    return null; // No placeholder, just hide when nothing selected
  }

  // Handle SUMMARY.MD synthetic files
  if (path.endsWith("SUMMARY.MD")) {
    const summaryNode = resolveSummaryNode(path, tree);
    if (summaryNode) {
      return (
        <div className="kpreview">
          <div className="kpreview-head">
            <button className="icon-btn" onClick={onBack} title="Back to tree">
              <Icon name="back" size={14} />
            </button>
            <span className="kpreview-path">{path}</span>
          </div>
          <div className="kpreview-body">
            <h3 className="ktitle" style={{ textTransform: "capitalize" }}>
              {summaryNode.name}
            </h3>
            <p className="ksummary">{summaryNode.summary}</p>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-3)",
                fontWeight: 600,
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              Sections
            </div>
            {summaryNode.children
              .filter((c) => c.type === "dir")
              .map((c) => (
                <div key={c.name} style={{ padding: "6px 0", fontSize: 13 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      fontFamily: "var(--font-mono)",
                      fontSize: 12.5,
                    }}
                  >
                    {c.name}/
                  </div>
                  <div style={{ color: "var(--text-2)", marginTop: 2 }}>
                    {c.summary}
                  </div>
                </div>
              ))}
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-3)",
                fontWeight: 600,
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              Pages
            </div>
            {summaryNode.children
              .filter((c) => c.type === "file")
              .map((c) => (
                <div key={c.name} style={{ padding: "6px 0", fontSize: 13 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      fontFamily: "var(--font-mono)",
                      fontSize: 12.5,
                    }}
                  >
                    {c.name}
                  </div>
                  <div style={{ color: "var(--text-2)", marginTop: 2 }}>
                    {c.frontmatter?.summary}
                  </div>
                </div>
              ))}
          </div>
        </div>
      );
    }
  }

  if (loading) {
    return (
      <div className="kpreview">
        <div className="kpreview-head">
          <button className="icon-btn" onClick={onBack} title="Back to tree">
            <Icon name="back" size={14} />
          </button>
        </div>
        <div className="kpreview-loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kpreview">
        <div className="kpreview-head">
          <button className="icon-btn" onClick={onBack} title="Back to tree">
            <Icon name="back" size={14} />
          </button>
          <span className="kpreview-path">{path}</span>
        </div>
        <div className="kpreview-body">
          <p style={{ color: "var(--text-3)" }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="kpreview">
        <div className="kpreview-head">
          <button className="icon-btn" onClick={onBack} title="Back to tree">
            <Icon name="back" size={14} />
          </button>
          <span className="kpreview-path">{path}</span>
        </div>
        <div className="kpreview-body">
          <p style={{ color: "var(--text-3)" }}>File not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kpreview">
      <div className="kpreview-head">
        <button className="icon-btn" onClick={onBack} title="Back to tree">
          <Icon name="back" size={14} />
        </button>
        <span className="kpreview-path">{path}</span>
      </div>
      <div className="kpreview-body">
        <FrontmatterView fm={file.frontmatter} />
        <h3 className="ktitle">{file.frontmatter.title}</h3>
        <div className="kbody">
          <MarkdownRenderer source={file.body} />
        </div>
        <div className="ksource-link">
          <a href={file.frontmatter.url} target="_blank" rel="noreferrer">
            {file.frontmatter.url}
          </a>
        </div>
      </div>
    </div>
  );
};
