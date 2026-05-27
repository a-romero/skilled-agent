import React from "react";
import { useSkills } from "../../hooks/useSkills";
import { Icon } from "../shared/Icon";
import type { Config } from "../../types/api";

interface SkillsPanelProps {
  config: Config;
  onConfigChange: (partial: Partial<Config>) => void;
  onToggleSkill: (skillName: string) => void;
}

export const SkillsPanel: React.FC<SkillsPanelProps> = ({
  config,
  onConfigChange,
  onToggleSkill,
}) => {
  const { skills, loading, error } = useSkills();
  const [skillsOpen, setSkillsOpen] = React.useState(true);
  const [configOpen, setConfigOpen] = React.useState(true);

  if (loading) {
    return (
      <div className="skills-panel" style={{ padding: "20px", color: "var(--text-2)" }}>
        Loading skills...
      </div>
    );
  }

  if (error) {
    return (
      <div className="skills-panel" style={{ padding: "20px", color: "var(--error)" }}>
        Error loading skills: {error}
      </div>
    );
  }

  const models = [
    { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
    { value: "anthropic/claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { value: "openai/gpt-4o", label: "GPT-4o" },
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  ];

  return (
    <div className="skills-panel">
      {/* Skills Section */}
      <div className="spane">
        <div
          className="spane-header"
          onClick={() => setSkillsOpen(!skillsOpen)}
          style={{ cursor: "pointer" }}
        >
          <Icon name="zap" size={13} />
          <span className="spane-title">Skills</span>
          <span className="spane-badge">
            {config.skills?.filter(s => skills.find(sk => sk.name === s)).length || 0}
          </span>
          <span
            className={"caret" + (skillsOpen ? " open" : "")}
            style={{ marginLeft: "auto" }}
          >
            <Icon name="chevron" size={11} />
          </span>
        </div>
        {skillsOpen && (
          <div className="spane-body">
            {skills.length === 0 ? (
              <div style={{ padding: "12px", color: "var(--text-3)", fontSize: "13px" }}>
                No skills available
              </div>
            ) : (
              skills.map(skill => (
                <label
                  key={skill.name}
                  className="skill-checkbox"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    padding: "8px 12px",
                    cursor: "pointer",
                    gap: "8px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.skills?.includes(skill.name) || false}
                    onChange={() => onToggleSkill(skill.name)}
                    style={{ marginTop: "2px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: 500, marginBottom: "2px" }}>
                      {skill.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-2)" }}>
                      {skill.description}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {/* Configuration Section */}
      <div className="spane" style={{ marginTop: "16px" }}>
        <div
          className="spane-header"
          onClick={() => setConfigOpen(!configOpen)}
          style={{ cursor: "pointer" }}
        >
          <Icon name="gear" size={13} />
          <span className="spane-title">Configuration</span>
          <span
            className={"caret" + (configOpen ? " open" : "")}
            style={{ marginLeft: "auto" }}
          >
            <Icon name="chevron" size={11} />
          </span>
        </div>
        {configOpen && (
          <div className="spane-body" style={{ padding: "12px" }}>
            {/* Model Selection */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="model-select"
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-3)",
                  marginBottom: "6px",
                }}
              >
                Model
              </label>
              <select
                id="model-select"
                value={config.model}
                onChange={e => onConfigChange({ model: e.target.value })}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: "13px",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  backgroundColor: "var(--bg-2)",
                  color: "var(--text)",
                }}
              >
                {models.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Temperature Slider */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="temperature-slider"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-3)",
                  marginBottom: "6px",
                }}
              >
                <span>Temperature</span>
                <span style={{ fontWeight: 400, color: "var(--text-2)" }}>
                  {config.temperature.toFixed(2)}
                </span>
              </label>
              <input
                id="temperature-slider"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={e => onConfigChange({ temperature: parseFloat(e.target.value) })}
                style={{ width: "100%" }}
              />
            </div>

            {/* Max Tokens Input */}
            <div>
              <label
                htmlFor="max-tokens-input"
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-3)",
                  marginBottom: "6px",
                }}
              >
                Max Tokens
              </label>
              <input
                id="max-tokens-input"
                type="number"
                min="256"
                max="32768"
                step="256"
                value={config.max_tokens}
                onChange={e => onConfigChange({ max_tokens: parseInt(e.target.value) || 8192 })}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: "13px",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  backgroundColor: "var(--bg-2)",
                  color: "var(--text)",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
