import { useChat } from "../../hooks/useChat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

interface ChatPaneProps {
  userName?: string;
  skills?: Array<{ name: string; description: string }>;
}

export function ChatPane({ userName = "User", skills = [] }: ChatPaneProps) {
  const { messages, loading, sendMessage } = useChat();

  // Extract user initials
  const userInitials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasMessages = messages.length > 0;

  return (
    <main className="pane chat">
      <div className="chat-header">
        <div>
          <div className="chat-title">Knowledge Assistant</div>
          <div className="chat-sub">
            skilled-agent · dspy · {skills.length} skill
            {skills.length === 1 ? "" : "s"} loaded
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
