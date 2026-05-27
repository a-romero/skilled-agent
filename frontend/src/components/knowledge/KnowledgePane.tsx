import React from "react";
import { useKnowledge } from "../../hooks/useKnowledge";
import { KnowledgeTree } from "./KnowledgeTree";
import { FilePreview } from "./FilePreview";

export const KnowledgePane: React.FC = () => {
  const { tree, expanded, selectedPath, loading, error, toggleFolder, selectFile } =
    useKnowledge();

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
    <div className="pane">
      <div className="tree-panel">
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
      </div>
      <div className="preview-panel">
        <FilePreview path={selectedPath} tree={tree} />
      </div>
    </div>
  );
};
