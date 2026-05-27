import React from "react";
import { Icon } from "../shared/Icon";
import type { KnowledgeNode } from "../../types/api";

interface KnowledgeTreeProps {
  node: KnowledgeNode;
  expanded: Set<string>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  depth?: number;
  pathPrefix?: string;
}

export const KnowledgeTree: React.FC<KnowledgeTreeProps> = ({
  node,
  expanded,
  selectedPath,
  onToggle,
  onSelect,
  depth = 0,
  pathPrefix = "",
}) => {
  const path = pathPrefix + node.name;
  const isDir = node.type === "dir";
  const isOpen = expanded.has(path);
  const isSelected = selectedPath === path;

  const handleClick = () => {
    if (isDir) {
      onToggle(path);
    } else {
      onSelect(path);
    }
  };

  return (
    <div className="knode">
      <div
        className={`krow${isSelected ? " selected" : ""}`}
        style={{ paddingLeft: 6 + depth * 12 }}
        onClick={handleClick}
      >
        <span className={`caret${isOpen ? " open" : ""}${!isDir ? " leaf" : ""}`}>
          <Icon name="chevron" size={11} />
        </span>
        <span className="kicon">
          {isDir ? (
            <Icon name={isOpen ? "folder-open" : "folder"} />
          ) : (
            <Icon name="file" />
          )}
        </span>
        <span className={`kname${isDir ? " dir" : ""}`}>{node.name}</span>
      </div>
      {isDir && isOpen && node.children && (
        <div className="kchildren">
          {/* Render synthetic SUMMARY.MD for directories */}
          <div
            className={`krow${
              selectedPath === `${path}/SUMMARY.MD` ? " selected" : ""
            }`}
            style={{ paddingLeft: 6 + (depth + 1) * 12 }}
            onClick={() => onSelect(`${path}/SUMMARY.MD`)}
          >
            <span className="caret leaf">
              <Icon name="chevron" size={11} />
            </span>
            <span className="kicon">
              <Icon name="file-summary" />
            </span>
            <span className="kname">SUMMARY.MD</span>
          </div>
          {/* Render children */}
          {node.children.map((child) => (
            <KnowledgeTree
              key={child.name}
              node={child}
              expanded={expanded}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
              depth={depth + 1}
              pathPrefix={`${path}/`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
