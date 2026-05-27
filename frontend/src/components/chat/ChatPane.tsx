import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import type { Config } from "../../types/api";

interface ChatPaneProps {
  userName?: string;
  config: Config;
  messages: any[]; // From parent (conversation messages)
  onSendMessage: (text: string) => void;
  loading: boolean;
}

const STARTERS = [
  { label: "Group Protection", q: "Can you explain group life insurance for employees?" },
  { label: "Claims", q: "How do I make a claim on a life insurance policy?" },
  { label: "Workplace Pensions", q: "What workplace pension options are available?" },
  { label: "Personal Life", q: "What's the difference between level and decreasing term life?" },
];

export function ChatPane({ userName = "User", config, messages, onSendMessage, loading }: ChatPaneProps) {
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
            {skillCount === 1 ? "" : "s"} loaded
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
        <div className="chat-inner">
          {!hasMessages && (
            <div className="suggest-wrap">
              <h1 className="suggest-hi">How can I help today?</h1>
              <p className="suggest-sub">
                Ask anything about Meridian's products — I'll navigate the knowledge base and cite
                every page I read.
              </p>
              <div className="suggest-grid">
                {STARTERS.map((starter) => (
                  <button
                    key={starter.q}
                    className="suggest-card"
                    onClick={() => onSendMessage(starter.q)}
                  >
                    <div className="suggest-label">{starter.label}</div>
                    <div className="suggest-q">{starter.q}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {hasMessages && (
            <MessageList messages={messages} userInitials={userInitials} />
          )}
        </div>
      </div>
      <ChatInput onSend={onSendMessage} disabled={loading} />
    </main>
  );
}
