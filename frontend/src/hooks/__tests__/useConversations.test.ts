import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useConversations } from "../useConversations";
import type { Message } from "../../types/api";

// Mock crypto.randomUUID
const mockUUIDs = ["uuid-1", "uuid-2", "uuid-3", "uuid-4"];
let uuidIndex = 0;
const mockRandomUUID = vi.fn(() => mockUUIDs[uuidIndex++]);
vi.stubGlobal("crypto", {
  randomUUID: mockRandomUUID,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Mock logger
vi.mock("../../utils/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("useConversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    uuidIndex = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initialization", () => {
    it("creates default conversation when localStorage is empty", () => {
      const { result } = renderHook(() => useConversations());

      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.conversations[0]).toMatchObject({
        id: "uuid-1",
        title: "New conversation",
        time: "now",
        active: true,
        messages: [],
      });
      expect(result.current.activeConversation).toBeDefined();
      expect(result.current.activeConversation?.id).toBe("uuid-1");
    });

    it("loads conversations from localStorage on mount", () => {
      const storedState = {
        conversations: [
          {
            id: "existing-1",
            title: "Existing conversation",
            time: "5m ago",
            active: true,
            messages: [
              { id: "msg-1", role: "user" as const, text: "Hello" },
            ],
          },
          {
            id: "existing-2",
            title: "Another conversation",
            time: "1h ago",
            active: false,
            messages: [],
          },
        ],
        activeConversationId: "existing-1",
      };

      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(storedState));

      const { result } = renderHook(() => useConversations());

      expect(result.current.conversations).toHaveLength(2);
      expect(result.current.conversations[0].title).toBe("Existing conversation");
      expect(result.current.activeConversation?.id).toBe("existing-1");
    });

    it("handles corrupt localStorage data gracefully", () => {
      localStorageMock.getItem.mockReturnValueOnce("{ invalid json");

      const { result } = renderHook(() => useConversations());

      // Should create default conversation
      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.conversations[0].title).toBe("New conversation");
    });
  });

  describe("Conversation Management", () => {
    it("newConversation creates new conversation and sets it active", () => {
      const { result } = renderHook(() => useConversations());

      const initialId = result.current.conversations[0].id;

      act(() => {
        result.current.newConversation();
      });

      expect(result.current.conversations).toHaveLength(2);
      expect(result.current.conversations[0]).toMatchObject({
        id: "uuid-2",
        title: "New conversation",
        time: "now",
        active: true,
        messages: [],
      });
      expect(result.current.activeConversation?.id).toBe("uuid-2");
    });

    it("newConversation deactivates previous conversation", () => {
      const { result } = renderHook(() => useConversations());

      act(() => {
        result.current.newConversation();
      });

      // Original conversation should be deactivated
      const oldConversation = result.current.conversations.find((c) => c.id === "uuid-1");
      expect(oldConversation?.active).toBe(false);

      // New conversation should be active
      const newConversation = result.current.conversations.find((c) => c.id === "uuid-2");
      expect(newConversation?.active).toBe(true);
    });

    it("loadConversation switches active conversation", () => {
      const { result } = renderHook(() => useConversations());

      // Create second conversation
      act(() => {
        result.current.newConversation();
      });

      const firstId = "uuid-1";
      const secondId = "uuid-2";

      expect(result.current.activeConversation?.id).toBe(secondId);

      // Switch back to first conversation
      act(() => {
        result.current.loadConversation(firstId);
      });

      expect(result.current.activeConversation?.id).toBe(firstId);

      const firstConv = result.current.conversations.find((c) => c.id === firstId);
      const secondConv = result.current.conversations.find((c) => c.id === secondId);

      expect(firstConv?.active).toBe(true);
      expect(secondConv?.active).toBe(false);
    });

    it("deleteConversation removes conversation", () => {
      const { result } = renderHook(() => useConversations());

      // Create second conversation
      act(() => {
        result.current.newConversation();
      });

      const firstId = "uuid-1";
      expect(result.current.conversations).toHaveLength(2);

      // Delete first conversation (inactive)
      act(() => {
        result.current.deleteConversation(firstId);
      });

      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.conversations.find((c) => c.id === firstId)).toBeUndefined();
    });

    it("deleteConversation switches to another when deleting active", () => {
      const { result } = renderHook(() => useConversations());

      // Create second conversation
      act(() => {
        result.current.newConversation();
      });

      const firstId = "uuid-1";
      const secondId = "uuid-2";

      expect(result.current.activeConversation?.id).toBe(secondId);

      // Delete active conversation
      act(() => {
        result.current.deleteConversation(secondId);
      });

      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.activeConversation?.id).toBe(firstId);
      expect(result.current.activeConversation?.active).toBe(true);
    });

    it("deleteConversation creates new when deleting last conversation", () => {
      const { result } = renderHook(() => useConversations());

      const firstId = result.current.conversations[0].id;

      // Delete the only conversation
      act(() => {
        result.current.deleteConversation(firstId);
      });

      // Should create a new default conversation
      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.conversations[0]).toMatchObject({
        id: "uuid-2",
        title: "New conversation",
        time: "now",
        active: true,
        messages: [],
      });
      expect(result.current.activeConversation?.id).toBe("uuid-2");
    });
  });

  describe("Message Updates", () => {
    it("updateActiveConversation updates messages", () => {
      const { result } = renderHook(() => useConversations());

      const messages: Message[] = [
        {
          id: "msg-1",
          role: "user",
          text: "Hello",
        },
        {
          id: "msg-2",
          role: "assistant",
          text: "Hi there!",
        },
      ];

      act(() => {
        result.current.updateActiveConversation(messages);
      });

      expect(result.current.activeConversation?.messages).toEqual(messages);
    });

    it("auto-generates title from first user message", () => {
      const { result } = renderHook(() => useConversations());

      const messages: Message[] = [
        {
          id: "msg-1",
          role: "user",
          text: "What is the capital of France?",
        },
      ];

      act(() => {
        result.current.updateActiveConversation(messages);
      });

      expect(result.current.activeConversation?.title).toBe("What is the capital of France?");
    });

    it("truncates long titles with ellipsis", () => {
      const { result } = renderHook(() => useConversations());

      const longText = "A".repeat(60);
      const messages: Message[] = [
        {
          id: "msg-1",
          role: "user",
          text: longText,
        },
      ];

      act(() => {
        result.current.updateActiveConversation(messages);
      });

      expect(result.current.activeConversation?.title).toBe("A".repeat(50) + "...");
      expect(result.current.activeConversation?.title.length).toBe(53);
    });

    it("updates relative time", () => {
      const { result } = renderHook(() => useConversations());

      const messages: Message[] = [
        { id: "msg-1", role: "user", text: "Hello" },
      ];

      act(() => {
        result.current.updateActiveConversation(messages);
      });

      // Time should be "now" since we're calling Date.now()
      expect(result.current.activeConversation?.time).toBe("now");
    });

    it("only updates active conversation", () => {
      const { result } = renderHook(() => useConversations());

      // Create second conversation
      act(() => {
        result.current.newConversation();
      });

      const firstId = "uuid-1";
      const secondId = "uuid-2";

      expect(result.current.activeConversation?.id).toBe(secondId);

      const messages: Message[] = [
        { id: "msg-1", role: "user", text: "Test message" },
      ];

      act(() => {
        result.current.updateActiveConversation(messages);
      });

      // Active conversation (second) should have messages
      const activeConv = result.current.conversations.find((c) => c.id === secondId);
      expect(activeConv?.messages).toEqual(messages);

      // First conversation should still be empty
      const firstConv = result.current.conversations.find((c) => c.id === firstId);
      expect(firstConv?.messages).toEqual([]);
    });

    it("does not regenerate title once set", () => {
      const { result } = renderHook(() => useConversations());

      const messages1: Message[] = [
        { id: "msg-1", role: "user", text: "First question" },
      ];

      act(() => {
        result.current.updateActiveConversation(messages1);
      });

      expect(result.current.activeConversation?.title).toBe("First question");

      const messages2: Message[] = [
        ...messages1,
        { id: "msg-2", role: "assistant", text: "Answer" },
        { id: "msg-3", role: "user", text: "Second question" },
      ];

      act(() => {
        result.current.updateActiveConversation(messages2);
      });

      // Title should remain "First question", not change to "Second question"
      expect(result.current.activeConversation?.title).toBe("First question");
    });
  });

  describe("Persistence", () => {
    it("saves to localStorage on state changes", () => {
      const { result } = renderHook(() => useConversations());

      act(() => {
        result.current.newConversation();
      });

      // Should have called setItem at least once
      expect(localStorageMock.setItem).toHaveBeenCalled();

      const lastCall = localStorageMock.setItem.mock.calls[
        localStorageMock.setItem.mock.calls.length - 1
      ];
      expect(lastCall[0]).toBe("meridian_conversations");

      const savedState = JSON.parse(lastCall[1]);
      expect(savedState.conversations).toHaveLength(2);
      expect(savedState.activeConversationId).toBe("uuid-2");
    });

    it("handles localStorage write errors", () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error("QuotaExceededError");
      });

      const { result } = renderHook(() => useConversations());

      // Should not throw, just log error
      expect(() => {
        act(() => {
          result.current.newConversation();
        });
      }).not.toThrow();
    });
  });

  describe("Utility: getRelativeTime", () => {
    // We can't directly test the internal function, but we can test it through updateActiveConversation

    it("returns 'now' for timestamps less than 1 minute ago", () => {
      const { result } = renderHook(() => useConversations());

      const messages: Message[] = [{ id: "msg-1", role: "user", text: "Hello" }];

      act(() => {
        result.current.updateActiveConversation(messages);
      });

      expect(result.current.activeConversation?.time).toBe("now");
    });

    it("returns minutes format for timestamps less than 1 hour ago", () => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      vi.spyOn(Date, "now")
        .mockReturnValueOnce(fiveMinutesAgo) // First call in updateActiveConversation
        .mockReturnValueOnce(now); // Second call for getRelativeTime calculation

      const { result } = renderHook(() => useConversations());

      const messages: Message[] = [{ id: "msg-1", role: "user", text: "Hello" }];

      act(() => {
        result.current.updateActiveConversation(messages);
      });

      expect(result.current.activeConversation?.time).toBe("5m ago");

      vi.restoreAllMocks();
    });

    it("returns hours format for timestamps less than 24 hours ago", () => {
      const now = Date.now();
      const threeHoursAgo = now - 3 * 60 * 60 * 1000;

      vi.spyOn(Date, "now")
        .mockReturnValueOnce(threeHoursAgo)
        .mockReturnValueOnce(now);

      const { result } = renderHook(() => useConversations());

      const messages: Message[] = [{ id: "msg-1", role: "user", text: "Hello" }];

      act(() => {
        result.current.updateActiveConversation(messages);
      });

      expect(result.current.activeConversation?.time).toBe("3h ago");

      vi.restoreAllMocks();
    });

    it("returns days format for timestamps 24+ hours ago", () => {
      const now = Date.now();
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

      vi.spyOn(Date, "now")
        .mockReturnValueOnce(twoDaysAgo)
        .mockReturnValueOnce(now);

      const { result } = renderHook(() => useConversations());

      const messages: Message[] = [{ id: "msg-1", role: "user", text: "Hello" }];

      act(() => {
        result.current.updateActiveConversation(messages);
      });

      expect(result.current.activeConversation?.time).toBe("2d ago");

      vi.restoreAllMocks();
    });
  });
});
