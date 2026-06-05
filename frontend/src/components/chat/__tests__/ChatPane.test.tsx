import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatPane } from "../ChatPane";
import type { Config } from "../../../types/api";

// Mock child components
vi.mock("../MessageList", () => ({
  MessageList: ({ messages, userInitials }: any) => (
    <div data-testid="message-list">
      Messages: {messages.length}, User: {userInitials}
    </div>
  ),
}));

vi.mock("../ChatInput", () => ({
  ChatInput: ({ onSend, disabled, config }: any) => (
    <div data-testid="chat-input">
      <button onClick={() => onSend("test")} disabled={disabled}>
        Send
      </button>
      Skills: {config.skills?.length || 0}
    </div>
  ),
}));

describe("ChatPane", () => {
  const mockConfig: Config = { skills: ["skill1", "skill2"] };
  const mockOnSendMessage = vi.fn();

  beforeEach(() => {
    mockOnSendMessage.mockClear();
  });

  test("renders header with title and status", () => {
    render(
      <ChatPane
        config={mockConfig}
        messages={[]}
        onSendMessage={mockOnSendMessage}
        loading={false}
      />
    );

    expect(screen.getByText("Knowledge Assistant")).toBeInTheDocument();
    expect(screen.getByText(/skilled-agent · dspy · 2 skills loaded/)).toBeInTheDocument();
    expect(screen.getByText("ready")).toBeInTheDocument();
  });

  test("shows loading status when loading", () => {
    render(
      <ChatPane
        config={mockConfig}
        messages={[]}
        onSendMessage={mockOnSendMessage}
        loading={true}
      />
    );

    expect(screen.getByText("working")).toBeInTheDocument();
    const statusDot = document.querySelector(".status-dot.thinking");
    expect(statusDot).toBeInTheDocument();
  });

  test("displays singular 'skill' when only one skill loaded", () => {
    const singleSkillConfig: Config = { skills: ["skill1"] };
    render(
      <ChatPane
        config={singleSkillConfig}
        messages={[]}
        onSendMessage={mockOnSendMessage}
        loading={false}
      />
    );

    expect(screen.getByText(/1 skill loaded/)).toBeInTheDocument();
  });

  test("shows starter suggestions when no messages", () => {
    render(
      <ChatPane
        config={mockConfig}
        messages={[]}
        onSendMessage={mockOnSendMessage}
        loading={false}
      />
    );

    expect(screen.getByText("How can I help today?")).toBeInTheDocument();
    expect(screen.getByText("Group Protection")).toBeInTheDocument();
    expect(screen.getByText("Claims")).toBeInTheDocument();
    expect(screen.getByText("Workplace Pensions")).toBeInTheDocument();
    expect(screen.getByText("Personal Life")).toBeInTheDocument();
  });

  test("clicking starter suggestion sends message", () => {
    render(
      <ChatPane
        config={mockConfig}
        messages={[]}
        onSendMessage={mockOnSendMessage}
        loading={false}
      />
    );

    const starterButton = screen.getByText("Group Protection").closest("button");
    fireEvent.click(starterButton!);

    expect(mockOnSendMessage).toHaveBeenCalledWith(
      "Can you explain group life insurance for employees?"
    );
  });

  test("shows MessageList when messages exist", () => {
    const messages = [
      { id: "1", role: "user", text: "Hello" },
      { id: "2", role: "assistant", text: "Hi there" },
    ];

    render(
      <ChatPane
        userName="John Doe"
        config={mockConfig}
        messages={messages}
        onSendMessage={mockOnSendMessage}
        loading={false}
      />
    );

    expect(screen.getByTestId("message-list")).toBeInTheDocument();
    expect(screen.getByText("Messages: 2, User: JD")).toBeInTheDocument();
    expect(screen.queryByText("How can I help today?")).not.toBeInTheDocument();
  });

  test("extracts user initials correctly", () => {
    render(
      <ChatPane
        userName="Alice Bob Charlie"
        config={mockConfig}
        messages={[{ id: "1", role: "user", text: "test" }]}
        onSendMessage={mockOnSendMessage}
        loading={false}
      />
    );

    expect(screen.getByText(/User: AB/)).toBeInTheDocument();
  });

  test("uses default user name when not provided", () => {
    render(
      <ChatPane
        config={mockConfig}
        messages={[{ id: "1", role: "user", text: "test" }]}
        onSendMessage={mockOnSendMessage}
        loading={false}
      />
    );

    // Default "User" has only one word, so initials will be "U"
    expect(screen.getByText(/User: U$/)).toBeInTheDocument();
  });

  test("renders ChatInput with correct props", () => {
    render(
      <ChatPane
        config={mockConfig}
        messages={[]}
        onSendMessage={mockOnSendMessage}
        loading={true}
        modelName="claude-3"
      />
    );

    const chatInput = screen.getByTestId("chat-input");
    expect(chatInput).toBeInTheDocument();
    expect(screen.getByText("Skills: 2")).toBeInTheDocument();
    
    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toBeDisabled();
  });

  test("handles empty skills array", () => {
    render(
      <ChatPane
        config={{ skills: [] }}
        messages={[]}
        onSendMessage={mockOnSendMessage}
        loading={false}
      />
    );

    expect(screen.getByText(/0 skills loaded/)).toBeInTheDocument();
  });

  test("handles undefined skills", () => {
    render(
      <ChatPane
        config={{}}
        messages={[]}
        onSendMessage={mockOnSendMessage}
        loading={false}
      />
    );

    expect(screen.getByText(/0 skills loaded/)).toBeInTheDocument();
  });
});
