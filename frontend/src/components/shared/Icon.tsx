import React from "react";

export type IconName =
  | "chevron"
  | "folder"
  | "folder-open"
  | "file"
  | "file-summary"
  | "search"
  | "send"
  | "plus"
  | "sun"
  | "moon"
  | "settings"
  | "gear"
  | "message"
  | "back"
  | "zap";

interface IconProps {
  name: IconName;
  size?: number;
}

export const Icon: React.FC<IconProps> = ({ name, size = 14 }) => {
  const s: React.SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    stroke: "currentColor",
    fill: "none",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { display: "inline-block", verticalAlign: "middle" },
  };

  switch (name) {
    case "chevron":
      return (
        <svg viewBox="0 0 16 16" {...s}>
          <polyline points="6,3 11,8 6,13" />
        </svg>
      );
    case "folder":
      return (
        <svg viewBox="0 0 16 16" {...s}>
          <path d="M1.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h6.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7.5Z" />
        </svg>
      );
    case "folder-open":
      return (
        <svg viewBox="0 0 16 16" {...s}>
          <path d="M1.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h6.5a1 1 0 0 1 1 1V6H1.5V4.5Z" />
          <path d="M1.5 6h13l-1.4 5.8a1 1 0 0 1-1 .7h-10.2a1 1 0 0 1-1-.8L1.5 6Z" />
        </svg>
      );
    case "file":
      return (
        <svg viewBox="0 0 16 16" {...s}>
          <path d="M4 2h5l3 3v9H4z" />
          <path d="M9 2v3h3" />
        </svg>
      );
    case "file-summary":
      return (
        <svg viewBox="0 0 16 16" {...s}>
          <path d="M4 2h5l3 3v9H4z" />
          <path d="M9 2v3h3" />
          <line x1="6" y1="9" x2="10" y2="9" />
          <line x1="6" y1="11" x2="10" y2="11" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 16 16" {...s} style={{ ...s.style, width: 13, height: 13 }}>
          <circle cx="7" cy="7" r="4.5" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" />
        </svg>
      );
    case "send":
      return (
        <svg viewBox="0 0 16 16" {...s} strokeWidth={1.8}>
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 16 16" {...s}>
          <line x1="8" y1="3" x2="8" y2="13" />
          <line x1="3" y1="8" x2="13" y2="8" />
        </svg>
      );
    case "sun":
      return (
        <svg viewBox="0 0 16 16" {...s}>
          <circle cx="8" cy="8" r="3" />
          <line x1="8" y1="1" x2="8" y2="3" />
          <line x1="8" y1="13" x2="8" y2="15" />
          <line x1="1" y1="8" x2="3" y2="8" />
          <line x1="13" y1="8" x2="15" y2="8" />
          <line x1="3" y1="3" x2="4.5" y2="4.5" />
          <line x1="11.5" y1="11.5" x2="13" y2="13" />
          <line x1="3" y1="13" x2="4.5" y2="11.5" />
          <line x1="11.5" y1="4.5" x2="13" y2="3" />
        </svg>
      );
    case "moon":
      return (
        <svg viewBox="0 0 16 16" {...s}>
          <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5Z" />
        </svg>
      );
    case "settings":
    case "gear":
      return (
        <svg viewBox="0 0 16 16" {...s}>
          <circle cx="8" cy="8" r="2" />
          <path d="M12.5 8a4.5 4.5 0 0 0-.1-1l1.3-1-1-1.7-1.5.5a4.5 4.5 0 0 0-1.7-1l-.3-1.6h-2l-.3 1.6a4.5 4.5 0 0 0-1.7 1l-1.5-.5-1 1.7 1.3 1a4.5 4.5 0 0 0 0 2l-1.3 1 1 1.7 1.5-.5a4.5 4.5 0 0 0 1.7 1l.3 1.6h2l.3-1.6a4.5 4.5 0 0 0 1.7-1l1.5.5 1-1.7-1.3-1a4.5 4.5 0 0 0 .1-1Z" />
        </svg>
      );
    case "message":
      return (
        <svg viewBox="0 0 16 16" {...s}>
          <path d="M2 3h12v8H6l-3 3v-3H2z" />
        </svg>
      );
    case "back":
      return (
        <svg viewBox="0 0 16 16" {...s}>
          <path d="M10 3 5 8l5 5" />
        </svg>
      );
    case "zap":
      return (
        <svg viewBox="0 0 16 16" {...s}>
          <path d="M9 1 3 9h4l-1 6 6-8H8l1-6Z" />
        </svg>
      );
    default:
      return null;
  }
};
