import { KnowledgePane } from "./components/knowledge/KnowledgePane";
import { ChatPane } from "./components/chat/ChatPane";
import { SkillsPanel } from "./components/skills/SkillsPanel";
import { useConfig } from "./hooks/useConfig";

function App() {
  const { config, updateConfig, toggleSkill } = useConfig();

  return (
    <div className="app">
      <KnowledgePane />
      <div className="pane">
        <SkillsPanel
          config={config}
          onConfigChange={updateConfig}
          onToggleSkill={toggleSkill}
        />
      </div>
      <ChatPane userName="User" config={config} />
    </div>
  );
}

export default App;
