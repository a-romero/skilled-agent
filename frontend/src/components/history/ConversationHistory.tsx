import React from "react";
import { Icon } from "../shared/Icon";
import type { Conversation } from "../../hooks/useConversations";

interface ConversationHistoryProps {
  conversations: Conversation[];
  onNew: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  theme: string;
  onToggleTheme: () => void;
  userName?: string;
  userOrg?: string;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  conversations,
  onNew,
  onLoad,
  onDelete,
  theme,
  onToggleTheme,
  userName = "User",
  userOrg = "Organization",
}) => {
  const userInitials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="pane">
      <div className="brand">
        <div className="brand-mark" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="brand-name">Open Virtual Assistant</div>
        </div>
      </div>

      <button className="new-chat" onClick={onNew}>
        <Icon name="plus" size={13} /> New conversation
      </button>

      <div className="history-label">Recent</div>
      <div className="history-list">
        {conversations.map((c) => (
          <div
            key={c.id}
            className={"history-item" + (c.active ? " active" : "")}
          >
            <Icon name="message" size={12} />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                cursor: "pointer",
              }}
              onClick={() => onLoad(c.id)}
            >
              {c.title}
            </span>
            <span className="history-time">{c.time}</span>
            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              title="Delete conversation"
              style={{ marginLeft: 4 }}
            >
              <Icon name="back" size={10} style={{ transform: "rotate(180deg)" }} />
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="avatar">{userInitials}</div>
        <div className="user-info">
          <div className="user-name">{userName}</div>
          <div className="user-role">{userOrg}</div>
        </div>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title="Toggle theme"
        >
          <Icon name={theme === "light" ? "moon" : "sun"} size={14} />
        </button>
      </div>
    </aside>
  );
};
