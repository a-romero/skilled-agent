import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MessageList } from "../MessageList";
import type { Message } from "../../../types/api";

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe("MessageList", () => {
  it("renders empty list", () => {
    const { container } = render(<MessageList messages={[]} />);
    expect(container.querySelector(".chat-inner")).toBeInTheDocument();
  });

  it("renders single message", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        text: "Hello",
      },
    ];

    render(<MessageList messages={messages} />);
    
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("renders multiple messages in order", () => {
    const messages: Message[] = [
      { id: "1", role: "user", text: "First message" },
      { id: "2", role: "assistant", text: "Second message" },
      { id: "3", role: "user", text: "Third message" },
    ];

    render(<MessageList messages={messages} />);
    
    const messageElements = screen.getAllByText(/message/);
    expect(messageElements).toHaveLength(3);
    expect(screen.getByText("First message")).toBeInTheDocument();
    expect(screen.getByText("Second message")).toBeInTheDocument();
    expect(screen.getByText("Third message")).toBeInTheDocument();
  });

  it("passes userInitials to MessageBubble components", () => {
    const messages: Message[] = [
      { id: "1", role: "user", text: "Test" },
    ];

    render(<MessageList messages={messages} userInitials="AR" />);
    
    expect(screen.getByText("AR")).toBeInTheDocument();
  });

  it("uses default userInitials when not provided", () => {
    const messages: Message[] = [
      { id: "1", role: "user", text: "Test" },
    ];

    render(<MessageList messages={messages} />);
    
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("renders messages with unique keys", () => {
    const messages: Message[] = [
      { id: "msg-1", role: "user", text: "Message 1" },
      { id: "msg-2", role: "assistant", text: "Message 2" },
      { id: "msg-3", role: "user", text: "Message 3" },
    ];

    const { container } = render(<MessageList messages={messages} />);
    
    const messageElements = container.querySelectorAll(".msg");
    expect(messageElements).toHaveLength(3);
  });

  it("calls scrollIntoView when messages change", () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    
    const messages1: Message[] = [
      { id: "1", role: "user", text: "First" },
    ];

    const { rerender } = render(<MessageList messages={messages1} />);
    
    const initialCalls = scrollSpy.mock.calls.length;
    
    const messages2: Message[] = [
      { id: "1", role: "user", text: "First" },
      { id: "2", role: "assistant", text: "Second" },
    ];

    rerender(<MessageList messages={messages2} />);
    
    // Should have been called at least once more
    expect(scrollSpy.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it("renders conversation with alternating roles", () => {
    const messages: Message[] = [
      { id: "1", role: "user", text: "Question 1" },
      { id: "2", role: "assistant", text: "Answer 1" },
      { id: "3", role: "user", text: "Question 2" },
      { id: "4", role: "assistant", text: "Answer 2" },
    ];

    render(<MessageList messages={messages} />);
    
    expect(screen.getAllByText("You")).toHaveLength(2);
    expect(screen.getAllByText("Open Virtual Assistant")).toHaveLength(2);
  });

  it("renders messages with trace and sources", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "assistant",
        text: "Answer with sources",
        sources: ["knowledge/file.md"],
        trace: [{ kind: "search", query: "test" }],
      },
    ];

    render(<MessageList messages={messages} />);
    
    expect(screen.getByText("Answer with sources")).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("file.md")).toBeInTheDocument();
  });

  it("renders streaming message", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "assistant",
        text: "Streaming...",
        streaming: true,
      },
    ];

    const { container } = render(<MessageList messages={messages} />);
    
    expect(screen.getByText("Streaming...")).toBeInTheDocument();
    expect(container.querySelector(".stream-caret")).toBeInTheDocument();
  });

  it("handles long conversation history", () => {
    const messages: Message[] = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      text: `Message ${i}`,
    })) as Message[];

    render(<MessageList messages={messages} />);
    
    expect(screen.getByText("Message 0")).toBeInTheDocument();
    expect(screen.getByText("Message 49")).toBeInTheDocument();
  });

  it("renders messages with empty text", () => {
    const messages: Message[] = [
      { id: "1", role: "user", text: "" },
      { id: "2", role: "assistant", text: "" },
    ];

    const { container } = render(<MessageList messages={messages} />);
    
    expect(container.querySelectorAll(".msg")).toHaveLength(2);
  });

  it("maintains scroll position element", () => {
    const messages: Message[] = [
      { id: "1", role: "user", text: "Test" },
    ];

    const { container } = render(<MessageList messages={messages} />);
    
    const scrollAnchor = container.querySelector(".chat-inner > div:last-child");
    expect(scrollAnchor).toBeInTheDocument();
  });

  it("updates when messages array reference changes", () => {
    const messages1: Message[] = [
      { id: "1", role: "user", text: "First" },
    ];

    const { rerender } = render(<MessageList messages={messages1} />);
    expect(screen.getByText("First")).toBeInTheDocument();
    
    const messages2: Message[] = [
      { id: "1", role: "user", text: "First" },
      { id: "2", role: "assistant", text: "Second" },
    ];

    rerender(<MessageList messages={messages2} />);
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
});
