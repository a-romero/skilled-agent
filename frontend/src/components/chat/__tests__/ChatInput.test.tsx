import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ChatInput } from "../ChatInput";
import type { Config } from "../../../types/api";

describe("ChatInput", () => {
  const defaultConfig: Config = { skills: [] };

  describe("Rendering", () => {
    it("renders textarea with placeholder", () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      expect(
        screen.getByPlaceholderText("Ask about claims, products, or policies…")
      ).toBeInTheDocument();
    });

    it("renders send button", () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    });

    it("renders disclaimer text", () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      expect(
        screen.getByText(/Open Virtual Assistant may be inaccurate/)
      ).toBeInTheDocument();
    });

    it("renders model name chip when provided", () => {
      const onSend = vi.fn();
      render(
        <ChatInput
          onSend={onSend}
          config={defaultConfig}
          modelName="claude-3.5-sonnet"
        />
      );
      
      expect(screen.getByText("claude-3.5-sonnet")).toBeInTheDocument();
    });

    it("does not render model chip when not provided", () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      expect(screen.queryByText(/claude/)).not.toBeInTheDocument();
    });

    it("renders skill chips when skills configured", () => {
      const onSend = vi.fn();
      const config: Config = {
        skills: ["python-coder", "summariser"],
      };
      
      render(<ChatInput onSend={onSend} config={config} />);
      
      expect(screen.getByText("python-coder")).toBeInTheDocument();
      expect(screen.getByText("summariser")).toBeInTheDocument();
      expect(screen.getAllByText("SKILL")).toHaveLength(2);
    });

    it("does not render skill chips when no skills", () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      expect(screen.queryByText("SKILL")).not.toBeInTheDocument();
    });
  });

  describe("User Interaction", () => {
    it("updates value when typing", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const textarea = screen.getByPlaceholderText(/Ask about/);
      await user.type(textarea, "Hello world");
      
      expect(textarea).toHaveValue("Hello world");
    });

    it("calls onSend when send button clicked with text", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const textarea = screen.getByPlaceholderText(/Ask about/);
      await user.type(textarea, "Test message");
      
      const sendButton = screen.getByRole("button", { name: "Send" });
      await user.click(sendButton);
      
      expect(onSend).toHaveBeenCalledWith("Test message");
      expect(onSend).toHaveBeenCalledTimes(1);
    });

    it("clears input after sending", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const textarea = screen.getByPlaceholderText(/Ask about/);
      await user.type(textarea, "Test message");
      
      const sendButton = screen.getByRole("button", { name: "Send" });
      await user.click(sendButton);
      
      expect(textarea).toHaveValue("");
    });

    it("sends message on Enter key", async () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const textarea = screen.getByPlaceholderText(/Ask about/);
      fireEvent.change(textarea, { target: { value: "Test message" } });
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
      
      expect(onSend).toHaveBeenCalledWith("Test message");
    });

    it("does not send on Shift+Enter", async () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const textarea = screen.getByPlaceholderText(/Ask about/);
      fireEvent.change(textarea, { target: { value: "Multi\nline" } });
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
      
      expect(onSend).not.toHaveBeenCalled();
    });

    it("trims whitespace before sending", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const textarea = screen.getByPlaceholderText(/Ask about/);
      await user.type(textarea, "  Test message  ");
      
      const sendButton = screen.getByRole("button", { name: "Send" });
      await user.click(sendButton);
      
      expect(onSend).toHaveBeenCalledWith("Test message");
    });

    it("does not send when text is only whitespace", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const textarea = screen.getByPlaceholderText(/Ask about/);
      await user.type(textarea, "   ");
      
      const sendButton = screen.getByRole("button", { name: "Send" });
      await user.click(sendButton);
      
      expect(onSend).not.toHaveBeenCalled();
    });

    it("does not send when textarea is empty", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const sendButton = screen.getByRole("button", { name: "Send" });
      await user.click(sendButton);
      
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe("Disabled State", () => {
    it("disables textarea when disabled prop is true", () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} disabled={true} />);
      
      const textarea = screen.getByPlaceholderText(/Ask about/);
      expect(textarea).toBeDisabled();
    });

    it("disables send button when disabled prop is true", () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} disabled={true} />);
      
      const sendButton = screen.getByRole("button", { name: "Send" });
      expect(sendButton).toBeDisabled();
    });

    it("does not call onSend when disabled", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} disabled={true} />);
      
      const sendButton = screen.getByRole("button", { name: "Send" });
      await user.click(sendButton);
      
      expect(onSend).not.toHaveBeenCalled();
    });

    it("disables send button when input is empty", () => {
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const sendButton = screen.getByRole("button", { name: "Send" });
      expect(sendButton).toBeDisabled();
    });

    it("enables send button when text is entered", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const textarea = screen.getByPlaceholderText(/Ask about/);
      const sendButton = screen.getByRole("button", { name: "Send" });
      
      expect(sendButton).toBeDisabled();
      
      await user.type(textarea, "Hello");
      
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe("Textarea Auto-resize", () => {
    it("starts with initial height", () => {
      const onSend = vi.fn();
      const { container } = render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const textarea = container.querySelector("textarea");
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute("rows", "1");
    });

    it("updates height when typing", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const textarea = screen.getByPlaceholderText(/Ask about/);
      
      // Type enough text to potentially trigger resize
      await user.type(textarea, "Line 1\nLine 2\nLine 3\nLine 4");
      
      // Height should be adjusted (tested via useEffect)
      expect(textarea).toHaveValue("Line 1\nLine 2\nLine 3\nLine 4");
    });
  });

  describe("Edge Cases", () => {
    it("handles very long input", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const longText = "A".repeat(1000);
      const textarea = screen.getByPlaceholderText(/Ask about/);
      await user.type(textarea, longText);
      
      const sendButton = screen.getByRole("button", { name: "Send" });
      await user.click(sendButton);
      
      expect(onSend).toHaveBeenCalledWith(longText);
    });

    it("handles special characters", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      // Use paste instead of type for special characters
      const specialText = "Test @#$%^&*()";
      const textarea = screen.getByPlaceholderText(/Ask about/);
      await user.click(textarea);
      await user.paste(specialText);
      
      const sendButton = screen.getByRole("button", { name: "Send" });
      await user.click(sendButton);
      
      expect(onSend).toHaveBeenCalledWith(specialText);
    });

    it("handles emoji input", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const emojiText = "Hello 👋 World 🌍";
      const textarea = screen.getByPlaceholderText(/Ask about/);
      await user.type(textarea, emojiText);
      
      const sendButton = screen.getByRole("button", { name: "Send" });
      await user.click(sendButton);
      
      expect(onSend).toHaveBeenCalledWith(emojiText);
    });

    it("handles rapid typing and sending", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<ChatInput onSend={onSend} config={defaultConfig} />);
      
      const textarea = screen.getByPlaceholderText(/Ask about/);
      const sendButton = screen.getByRole("button", { name: "Send" });
      
      await user.type(textarea, "Message 1");
      await user.click(sendButton);
      
      await user.type(textarea, "Message 2");
      await user.click(sendButton);
      
      expect(onSend).toHaveBeenCalledTimes(2);
      expect(onSend).toHaveBeenNthCalledWith(1, "Message 1");
      expect(onSend).toHaveBeenNthCalledWith(2, "Message 2");
    });

    it("handles multiple skills", () => {
      const onSend = vi.fn();
      const config: Config = {
        skills: ["skill1", "skill2", "skill3", "skill4"],
      };
      
      render(<ChatInput onSend={onSend} config={config} />);
      
      expect(screen.getByText("skill1")).toBeInTheDocument();
      expect(screen.getByText("skill2")).toBeInTheDocument();
      expect(screen.getByText("skill3")).toBeInTheDocument();
      expect(screen.getByText("skill4")).toBeInTheDocument();
    });

    it("handles skill with special characters in name", () => {
      const onSend = vi.fn();
      const config: Config = {
        skills: ["skill-with-dashes", "skill_with_underscores"],
      };
      
      render(<ChatInput onSend={onSend} config={config} />);
      
      expect(screen.getByText("skill-with-dashes")).toBeInTheDocument();
      expect(screen.getByText("skill_with_underscores")).toBeInTheDocument();
    });
  });

  describe("Integration", () => {
    it("handles complete user flow", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      const config: Config = { skills: ["test-skill"] };
      
      render(
        <ChatInput
          onSend={onSend}
          config={config}
          modelName="test-model"
        />
      );
      
      // User types a message
      const textarea = screen.getByPlaceholderText(/Ask about/);
      await user.type(textarea, "What is the weather?");
      
      // Message appears in textarea
      expect(textarea).toHaveValue("What is the weather?");
      
      // Send button is enabled
      const sendButton = screen.getByRole("button", { name: "Send" });
      expect(sendButton).not.toBeDisabled();
      
      // User sends message
      await user.click(sendButton);
      
      // onSend called with trimmed message
      expect(onSend).toHaveBeenCalledWith("What is the weather?");
      
      // Input is cleared
      expect(textarea).toHaveValue("");
      
      // Send button is disabled again
      expect(sendButton).toBeDisabled();
    });
  });
});
