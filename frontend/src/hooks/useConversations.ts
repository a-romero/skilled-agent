import { useState, useEffect, useCallback } from "react";
import type { Message } from "../types/api";

export interface Conversation {
  id: string;
  title: string;
  time: string;
  active: boolean;
  messages: Message[];
}

interface ConversationsState {
  conversations: Conversation[];
  activeConversationId: string;
}

const STORAGE_KEY = "meridian_conversations";

function loadFromStorage(): ConversationsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to load conversations:", e);
  }
  
  // Default: one empty conversation
  const defaultId = crypto.randomUUID();
  return {
    conversations: [
      {
        id: defaultId,
        title: "New conversation",
        time: "now",
        active: true,
        messages: [],
      },
    ],
    activeConversationId: defaultId,
  };
}

function saveToStorage(state: ConversationsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save conversations:", e);
  }
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function useConversations() {
  const [state, setState] = useState<ConversationsState>(loadFromStorage);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const activeConversation = state.conversations.find(
    (c) => c.id === state.activeConversationId
  );

  const newConversation = () => {
    const newId = crypto.randomUUID();
    setState((prev) => ({
      conversations: [
        {
          id: newId,
          title: "New conversation",
          time: "now",
          active: true,
          messages: [],
        },
        ...prev.conversations.map((c) => ({ ...c, active: false })),
      ],
      activeConversationId: newId,
    }));
  };

  const loadConversation = (id: string) => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) => ({
        ...c,
        active: c.id === id,
      })),
      activeConversationId: id,
    }));
  };

  const updateActiveConversation = useCallback((messages: Message[]) => {
    setState((prev) => {
      const updated = prev.conversations.map((c) => {
        if (c.id === prev.activeConversationId) {
          // Auto-generate title from first user message if still default
          let title = c.title;
          if (title === "New conversation" && messages.length > 0) {
            const firstUserMsg = messages.find((m) => m.role === "user");
            if (firstUserMsg) {
              title = firstUserMsg.text.slice(0, 50);
              if (firstUserMsg.text.length > 50) title += "...";
            }
          }

          // Update relative time
          const time = getRelativeTime(Date.now());

          return { ...c, messages, title, time };
        }
        return c;
      });

      return { ...prev, conversations: updated };
    });
  }, []); // No dependencies - uses functional setState

  const deleteConversation = useCallback((id: string) => {
    setState((prev) => {
      const filtered = prev.conversations.filter((c) => c.id !== id);
      
      // If we deleted the active conversation, switch to another
      let newActiveId = prev.activeConversationId;
      if (id === prev.activeConversationId) {
        if (filtered.length > 0) {
          // Switch to the first remaining conversation
          newActiveId = filtered[0].id;
          filtered[0].active = true;
        } else {
          // No conversations left, create a new one
          const newId = crypto.randomUUID();
          filtered.push({
            id: newId,
            title: "New conversation",
            time: "now",
            active: true,
            messages: [],
          });
          newActiveId = newId;
        }
      }

      return {
        conversations: filtered.map((c) => ({
          ...c,
          active: c.id === newActiveId,
        })),
        activeConversationId: newActiveId,
      };
    });
  }, []);

  return {
    conversations: state.conversations,
    activeConversation,
    newConversation,
    loadConversation,
    updateActiveConversation,
    deleteConversation,
  };
}
