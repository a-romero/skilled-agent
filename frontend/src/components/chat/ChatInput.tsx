import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Icon } from "../shared/Icon";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "22px";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [value]);

  const handleSubmit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about claims, products, or policies…"
          rows={1}
          disabled={disabled}
        />
        <div className="composer-row">
          <button
            className="send-btn"
            disabled={!value.trim() || disabled}
            onClick={handleSubmit}
            aria-label="Send"
          >
            <Icon name="send" size={14} />
          </button>
        </div>
      </div>
      <div className="disclaimer">
        Open Virtual Assistant may be inaccurate — verify important info on the
        linked source pages.
      </div>
    </div>
  );
}
