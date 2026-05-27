import React from "react";
import { useSkills } from "../../hooks/useSkills";
import { Icon } from "../shared/Icon";
import type { Config } from "../../types/api";

interface SkillsPanelProps {
  config: Config;
  onToggleSkill: (skillName: string) => void;
}

export const SkillsPanel: React.FC<SkillsPanelProps> = ({
  config,
  onToggleSkill,
}) => {
  const { skills, loading, error } = useSkills();
  const [skillsOpen, setSkillsOpen] = React.useState(true);

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
    </div>
  );
};
