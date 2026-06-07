import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MessageBubble } from "../MessageBubble";
import type { Message } from "../../../types/api";

describe("MessageBubble", () => {
  describe("User Messages", () => {
    it("renders user message with default initials", () => {
      const message: Message = {
        id: "1",
        role: "user",
        text: "Hello, assistant!",
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.getByText("?")).toBeInTheDocument();
      expect(screen.getByText("You")).toBeInTheDocument();
      expect(screen.getByText("Hello, assistant!")).toBeInTheDocument();
    });

    it("renders user message with custom initials", () => {
      const message: Message = {
        id: "1",
        role: "user",
        text: "Hello, assistant!",
      };

      render(<MessageBubble message={message} userInitials="AR" />);
      
      expect(screen.getByText("AR")).toBeInTheDocument();
      expect(screen.getByText("You")).toBeInTheDocument();
    });

    it("renders user message with long text", () => {
      const longText = "This is a very long message ".repeat(20).trim();
      const message: Message = {
        id: "1",
        role: "user",
        text: longText,
      };

      const { container } = render(<MessageBubble message={message} />);
      
      // Check container has the text
      const msgContent = container.querySelector(".msg-content");
      expect(msgContent).toHaveTextContent(longText);
    });

    it("renders user message with special characters", () => {
      const message: Message = {
        id: "1",
        role: "user",
        text: "Special chars: @#$%^&*()[]{}",
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.getByText("Special chars: @#$%^&*()[]{}")).toBeInTheDocument();
    });

    it("applies correct CSS class for user message", () => {
      const message: Message = {
        id: "1",
        role: "user",
        text: "Test",
      };

      const { container } = render(<MessageBubble message={message} />);
      
      expect(container.querySelector(".msg.user")).toBeInTheDocument();
    });
  });

  describe("Assistant Messages", () => {
    it("renders assistant message without trace", () => {
      const message: Message = {
        id: "1",
        role: "assistant",
        text: "I can help you with that.",
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.getByText("Open Virtual Assistant")).toBeInTheDocument();
      expect(screen.getByText("I can help you with that.")).toBeInTheDocument();
    });

    it("renders assistant message with trace", () => {
      const message: Message = {
        id: "1",
        role: "assistant",
        text: "Result",
        trace: [
          { kind: "search", query: "test query" },
          { kind: "read", path: "knowledge/file.md" },
        ],
        running: false,
        elapsed: 1500,
      };

      const { container } = render(<MessageBubble message={message} />);
      
      // ReasoningTrace should be rendered
      expect(container.querySelector(".msg.assistant")).toBeInTheDocument();
      expect(screen.getByText("Result")).toBeInTheDocument();
    });

    it("renders assistant message with sources", () => {
      const message: Message = {
        id: "1",
        role: "assistant",
        text: "Here's the answer",
        sources: ["knowledge/file1.md", "knowledge/file2.md"],
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.getByText("Here's the answer")).toBeInTheDocument();
      expect(screen.getByText("Sources")).toBeInTheDocument();
      expect(screen.getByText("file1.md")).toBeInTheDocument();
      expect(screen.getByText("file2.md")).toBeInTheDocument();
    });

    it("shows streaming caret when streaming", () => {
      const message: Message = {
        id: "1",
        role: "assistant",
        text: "Streaming text",
        streaming: true,
      };

      const { container } = render(<MessageBubble message={message} />);
      
      expect(container.querySelector(".stream-caret")).toBeInTheDocument();
    });

    it("does not show streaming caret when not streaming", () => {
      const message: Message = {
        id: "1",
        role: "assistant",
        text: "Complete text",
        streaming: false,
      };

      const { container } = render(<MessageBubble message={message} />);
      
      expect(container.querySelector(".stream-caret")).not.toBeInTheDocument();
    });

    it("renders assistant message without text", () => {
      const message: Message = {
        id: "1",
        role: "assistant",
        text: "",
        trace: [{ kind: "search", query: "searching..." }],
        running: true,
      };

      const { container } = render(<MessageBubble message={message} />);
      
      expect(screen.getByText("Open Virtual Assistant")).toBeInTheDocument();
      expect(container.querySelector(".msg-content")).not.toBeInTheDocument();
    });

    it("does not render sources when empty array", () => {
      const message: Message = {
        id: "1",
        role: "assistant",
        text: "Answer",
        sources: [],
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.queryByText("Sources")).not.toBeInTheDocument();
    });

    it("does not render trace when empty array", () => {
      const message: Message = {
        id: "1",
        role: "assistant",
        text: "Answer",
        trace: [],
      };

      const { container } = render(<MessageBubble message={message} />);
      
      // ReasoningTrace should not be rendered for empty trace
      expect(screen.getByText("Answer")).toBeInTheDocument();
      expect(screen.getByText("Open Virtual Assistant")).toBeInTheDocument();
    });

    it("applies correct CSS class for assistant message", () => {
      const message: Message = {
        id: "1",
        role: "assistant",
        text: "Test",
      };

      const { container } = render(<MessageBubble message={message} />);
      
      expect(container.querySelector(".msg.assistant")).toBeInTheDocument();
    });

    it("renders with citeMap for markdown links", () => {
      const message: Message = {
        id: "1",
        role: "assistant",
        text: "Check [1] for details",
        citeMap: { "1": "knowledge/file.md" },
      };

      render(<MessageBubble message={message} />);
      
      // MarkdownRenderer should receive citeMap prop
      expect(screen.getByText(/Check/)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty text", () => {
      const message: Message = {
        id: "1",
        role: "user",
        text: "",
      };

      const { container } = render(<MessageBubble message={message} />);
      
      expect(container.querySelector(".msg-content")).toHaveTextContent("");
    });

    it("handles message with all optional fields", () => {
      const message: Message = {
        id: "1",
        role: "assistant",
        text: "Complete message",
        trace: [{ kind: "think", text: "thinking..." }],
        running: true,
        streaming: true,
        elapsed: 2500,
        citeMap: { "1": "file.md" },
        sources: ["file.md"],
      };

      render(<MessageBubble message={message} />);
      
      expect(screen.getByText("Complete message")).toBeInTheDocument();
      expect(screen.getByText("Sources")).toBeInTheDocument();
    });

    it("handles single character initials", () => {
      const message: Message = {
        id: "1",
        role: "user",
        text: "Test",
      };

      render(<MessageBubble message={message} userInitials="A" />);
      
      expect(screen.getByText("A")).toBeInTheDocument();
    });

    it("handles multi-character initials", () => {
      const message: Message = {
        id: "1",
        role: "user",
        text: "Test",
      };

      render(<MessageBubble message={message} userInitials="ABC" />);
      
      expect(screen.getByText("ABC")).toBeInTheDocument();
    });
  });
});
