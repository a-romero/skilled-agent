import React, { useState } from "react";
import { useKnowledge } from "../../hooks/useKnowledge";
import { KnowledgeTree } from "./KnowledgeTree";
import { FilePreview } from "./FilePreview";
import { Icon } from "../shared/Icon";

export const KnowledgePane: React.FC = () => {
  const { tree, expanded, selectedPath, loading, error, toggleFolder, selectFile } =
    useKnowledge();
  const [searchQ, setSearchQ] = useState("");

  if (loading) {
    return (
      <div className="pane" style={{ padding: 20 }}>
        Loading knowledge...
      </div>
    );
  }

  if (error) {
    return (
      <div className="pane" style={{ padding: 20, color: "var(--danger)" }}>
        Error loading knowledge: {error}
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="pane" style={{ padding: 20 }}>
        No knowledge data available
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative" }}>
      <div className="kpane-header">
        <Icon name="folder" size={14} />
        <span className="kpane-title">Knowledge</span>
        <span className="kpane-badge">Aviva KB</span>
      </div>
      <div className="ksearch">
        <span className="ksearch-icon">
          <Icon name="search" size={13} />
        </span>
        <input
          placeholder="Search knowledge…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
      </div>
      <div className="ktree">
        {/* Root SUMMARY.MD */}
        <div
          className={`krow${selectedPath === "SUMMARY.MD" ? " selected" : ""}`}
          style={{ paddingLeft: 6 }}
          onClick={() => selectFile("SUMMARY.MD")}
        >
          <span className="caret leaf">
            <span style={{ display: "inline-block", width: 11 }}>
              {/* Empty spacer for alignment */}
            </span>
          </span>
          <span className="kicon">
            <span style={{ fontSize: 14 }}>📄</span>
          </span>
          <span className="kname">SUMMARY.MD</span>
        </div>
        {/* Render tree children */}
        {tree.root.children.map((node) => (
          <KnowledgeTree
            key={node.name}
            node={node}
            expanded={expanded}
            selectedPath={selectedPath}
            onToggle={toggleFolder}
            onSelect={selectFile}
            depth={0}
            pathPrefix=""
          />
        ))}
      </div>
      {selectedPath && <FilePreview path={selectedPath} tree={tree} onBack={() => selectFile(null)} />}
    </div>
  );
};
