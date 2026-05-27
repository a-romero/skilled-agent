import { useChat } from "../../hooks/useChat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import type { Config } from "../../types/api";

interface ChatPaneProps {
  userName?: string;
  config: Config;
}

export function ChatPane({ userName = "User", config }: ChatPaneProps) {
  const { messages, loading, sendMessage } = useChat(config);

  // Extract user initials
  const userInitials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasMessages = messages.length > 0;
  const skillCount = config.skills?.length || 0;

  return (
    <main className="pane chat">
      <div className="chat-header">
        <div>
          <div className="chat-title">Knowledge Assistant</div>
          <div className="chat-sub">
            skilled-agent · dspy · {skillCount} skill
            {skillCount === 1 ? "" : "s"} enabled
          </div>
        </div>
        <div className="chat-status">
          <span className="status-pill">
            <span className={`status-dot${loading ? " thinking" : ""}`} />
            {loading ? "working" : "ready"}
          </span>
        </div>
      </div>
      <div className="chat-body">
        {!hasMessages && (
          <div className="chat-empty">
            <p>Ask me anything about your knowledge base.</p>
          </div>
        )}
        {hasMessages && (
          <MessageList messages={messages} userInitials={userInitials} />
        )}
      </div>
      <ChatInput onSend={sendMessage} disabled={loading} />
    </main>
  );
}
