import { useState, useCallback, useEffect } from "react";
import type { Message, ChatEvent, Config } from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function useChat(config: Config, conversationId: string, initialMessages: Message[] = []) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update messages when conversation changes (by ID, not reference)
  useEffect(() => {
    setMessages(initialMessages);
  }, [conversationId]); // Depend on ID, not message array

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    setLoading(true);
    setError(null);

    const userMsgId = `u${Date.now()}`;
    const assistantMsgId = `m${Date.now()}`;
    const t0 = Date.now();

    // Add user message and prepare assistant placeholder
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        text: text.trim(),
      },
      {
        id: assistantMsgId,
        role: "assistant",
        text: "",
        trace: [],
        running: true,
        streaming: false,
        elapsed: 0,
        citeMap: {},
        sources: [],
      },
    ]);

    const updateAssistantMessage = (
      updater: (msg: Message) => Partial<Message>
    ) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, ...updater(m) } : m
        )
      );
    };

    const tick = () => {
      const elapsed = Math.round((Date.now() - t0) / 100) / 10;
      updateAssistantMessage(() => ({ elapsed }));
    };

    try {
      // Build history from all prior messages
      const history = messages
        .filter((m) => !m.running && !m.streaming)
        .map((m) => ({ role: m.role, text: m.text }));

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: text.trim(), 
          history,
          config: {
            skills: config.skills,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body reader");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          let event: ChatEvent;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          tick();

          switch (event.kind) {
            case "read":
              updateAssistantMessage((m) => ({
                trace: [
                  ...(m.trace || []),
                  { kind: "read", path: event.path },
                ],
              }));
              // Brief pause for visual feedback
              await new Promise((r) => setTimeout(r, 150));
              break;

            case "think":
              updateAssistantMessage((m) => ({
                trace: [
                  ...(m.trace || []),
                  { kind: "think", text: event.text },
                ],
              }));
              break;

            case "search":
              updateAssistantMessage((m) => ({
                trace: [
                  ...(m.trace || []),
                  {
                    kind: "search",
                    query: event.query,
                    section: event.section,
                  },
                ],
              }));
              break;

            case "skill_list":
              updateAssistantMessage((m) => ({
                trace: [
                  ...(m.trace || []),
                  {
                    kind: "skill",
                    name: "list_skills",
                    desc: "Browsed skill library",
                  },
                ],
              }));
              break;

            case "skill_read":
              updateAssistantMessage((m) => ({
                trace: [
                  ...(m.trace || []),
                  {
                    kind: "skill",
                    name: event.name,
                    desc: event.desc,
                  },
                ],
              }));
              await new Promise((r) => setTimeout(r, 150));
              break;

            case "say_start":
              updateAssistantMessage(() => ({
                running: false,
                streaming: true,
              }));
              break;

            case "say_chunk":
              updateAssistantMessage((m) => ({
                text: (m.text || "") + event.text,
              }));
              break;

            case "say_end":
              updateAssistantMessage(() => ({
                streaming: false,
              }));
              break;

            case "sources":
              updateAssistantMessage(() => ({
                sources: event.paths || [],
              }));
              break;

            case "error":
              updateAssistantMessage(() => ({
                running: false,
                streaming: false,
                text: `Error: ${event.text}`,
              }));
              setError(event.text);
              break;
          }
        }
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown error occurred";
      updateAssistantMessage(() => ({
        running: false,
        streaming: false,
        text: `Network error: ${errorMsg}`,
      }));
      setError(errorMsg);
    } finally {
      updateAssistantMessage(() => ({
        running: false,
        streaming: false,
      }));
      tick();
      setLoading(false);
    }
  }, [messages, loading]);

  return {
    messages,
    loading,
    error,
    sendMessage,
  };
}
