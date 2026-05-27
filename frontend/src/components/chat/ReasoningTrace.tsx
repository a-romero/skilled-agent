import { useState } from "react";
import type { TraceStep } from "../../types/api";
import { Icon } from "../shared/Icon";

interface ReasoningTraceProps {
  steps: TraceStep[];
  running: boolean;
  elapsed: number;
}

function Breadcrumb({ path, active }: { path: string; active: boolean }) {
  const parts = path.split("/").filter(Boolean);
  return (
    <div className={`breadcrumb${active ? " active" : ""}`}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="breadcrumb-sep">/</span>}
          <span className="breadcrumb-part">{part}</span>
        </span>
      ))}
    </div>
  );
}

export function ReasoningTrace({ steps, running, elapsed }: ReasoningTraceProps) {
  const [open, setOpen] = useState(true);

  const readCount = steps.filter((s) => s.kind === "read").length;
  const searchCount = steps.filter((s) => s.kind === "search").length;
  const skillCount = steps.filter((s) => s.kind === "skill").length;

  return (
    <div className={`trace${open ? " open" : ""}`}>
      <div className="trace-head" onClick={() => setOpen((o) => !o)}>
        <span className={`dot${running ? " active" : ""}`}></span>
        <span className="trace-title">
          {running ? "Thinking…" : "Thought process"}
        </span>
        <span className="trace-stats">
          {searchCount > 0 && (
            <>
              {searchCount} search{searchCount === 1 ? "" : "es"} ·{" "}
            </>
          )}
          {readCount} read · {skillCount} skill{skillCount === 1 ? "" : "s"} ·{" "}
          {elapsed}s
        </span>
        <span className="trace-caret">
          <Icon name="chevron" size={11} />
        </span>
      </div>
      <div className="trace-body">
        {steps.map((s, i) => {
          const active = running && i === steps.length - 1;

          if (s.kind === "think") {
            return (
              <div key={i} className={`step think${active ? " active" : ""}`}>
                <span className="step-bullet"></span>
                <span className="step-body">{s.text}</span>
              </div>
            );
          }

          if (s.kind === "read") {
            return (
              <div key={i} className={`step read${active ? " active" : ""}`}>
                <span className="step-bullet"></span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="step-body">
                    <span className="tool-tag">read_knowledge</span>
                    <span>{s.path}</span>
                  </span>
                  <Breadcrumb path={s.path || ""} active={active} />
                </div>
              </div>
            );
          }

          if (s.kind === "search") {
            return (
              <div key={i} className={`step search${active ? " active" : ""}`}>
                <span className="step-bullet"></span>
                <span className="step-body">
                  <span className="search-tag">search_knowledge_graph</span>
                  <span>
                    {s.query}
                    {s.section && (
                      <>
                        {" "}
                        ·{" "}
                        <span style={{ color: "var(--text-3)" }}>
                          § {s.section}
                        </span>
                      </>
                    )}
                  </span>
                </span>
              </div>
            );
          }

          if (s.kind === "skill") {
            return (
              <div key={i} className={`step skill${active ? " active" : ""}`}>
                <span className="step-bullet"></span>
                <span className="step-body">
                  <span className="skill-tag">SKILL</span>
                  <strong>{s.name}</strong>
                  <span style={{ color: "var(--text-3)" }}>· {s.desc}</span>
                </span>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
