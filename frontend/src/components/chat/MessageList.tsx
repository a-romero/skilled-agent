import { useEffect, useRef } from "react";
import type { Message } from "../../types/api";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  userInitials?: string;
}

export function MessageList({ messages, userInitials }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-inner">
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          userInitials={userInitials}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
