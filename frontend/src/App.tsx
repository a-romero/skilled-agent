import { useState, useEffect } from "react";
import { ConversationHistory } from "./components/history/ConversationHistory";
import { KnowledgePane } from "./components/knowledge/KnowledgePane";
import { ChatPane } from "./components/chat/ChatPane";
import { SkillsPanel } from "./components/skills/SkillsPanel";
import { useConfig } from "./hooks/useConfig";
import { useConversations } from "./hooks/useConversations";
import { useChat } from "./hooks/useChat";

function App() {
  const { config, toggleSkill, runtimeConfig } = useConfig();
  const {
    conversations,
    activeConversation,
    newConversation,
    loadConversation,
    updateActiveConversation,
    deleteConversation,
  } = useConversations();

  // Theme management
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("meridian_theme");
    return saved || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("meridian_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Chat integration
  const { messages, loading, sendMessage } = useChat(
    config,
    activeConversation?.id || "",
    activeConversation?.messages || []
  );

  // Sync messages back to conversation storage
  useEffect(() => {
    if (messages.length > 0) {
      updateActiveConversation(messages);
    }
  }, [messages, updateActiveConversation]);

  return (
    <div className="app">
      <ConversationHistory
        conversations={conversations}
        onNew={newConversation}
        onLoad={loadConversation}
        onDelete={deleteConversation}
        theme={theme}
        onToggleTheme={toggleTheme}
        userName={runtimeConfig?.user || "User"}
        userOrg={runtimeConfig?.org || "Organization"}
      />
      <aside className="pane" style={{ position: "relative" }}>
        <KnowledgePane />
        <SkillsPanel config={config} onToggleSkill={toggleSkill} />
      </aside>
      <ChatPane
        userName={runtimeConfig?.user || "User"}
        config={config}
        messages={messages}
        onSendMessage={sendMessage}
        loading={loading}
        modelName={runtimeConfig?.model || ""}
      />
    </div>
  );
}

export default App;
