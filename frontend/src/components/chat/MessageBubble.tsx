import type { Message } from "../../types/api";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";
import { ReasoningTrace } from "./ReasoningTrace";
import { CitationList } from "./CitationList";

interface MessageBubbleProps {
  message: Message;
  userInitials?: string;
}

export function MessageBubble({ message, userInitials = "?" }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="msg user">
        <div className="msg-role">
          <span className="av">{userInitials}</span>
          <span>You</span>
        </div>
        <div className="msg-content">{message.text}</div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="msg assistant">
      <div className="msg-role">
        <span className="av"></span>
        <span>Open Virtual Assistant</span>
      </div>
      {message.trace && message.trace.length > 0 && (
        <ReasoningTrace
          steps={message.trace}
          running={message.running || false}
          elapsed={message.elapsed || 0}
        />
      )}
      {message.text && (
        <div className="msg-content">
          <MarkdownRenderer source={message.text} citeMap={message.citeMap} />
          {message.streaming && <span className="stream-caret" />}
        </div>
      )}
      {message.sources && message.sources.length > 0 && (
        <CitationList sources={message.sources} />
      )}
    </div>
  );
}
