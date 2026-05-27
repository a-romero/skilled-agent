interface CitationListProps {
  sources: string[];
}

export function CitationList({ sources }: CitationListProps) {
  if (!sources || sources.length === 0) return null;

  const handleSourceClick = (path: string) => {
    // Dispatch custom event for opening knowledge file
    // This will be handled by KnowledgePane
    window.dispatchEvent(
      new CustomEvent("open-knowledge-file", {
        detail: { path },
      })
    );
  };

  return (
    <div className="sources">
      <div className="sources-head">Sources</div>
      {sources.map((path, i) => {
        // Extract filename for display
        const parts = path.split("/");
        const filename = parts[parts.length - 1] || path;
        
        return (
          <div
            key={path}
            className="source-item"
            onClick={() => handleSourceClick(path)}
          >
            <span className="source-num">{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="source-title">{filename}</div>
              <div className="source-url">{path}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
