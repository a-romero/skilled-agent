// API type definitions matching backend responses

export interface Frontmatter {
  url: string;
  title: string;
  summary: string;
  topics: string[];
  keywords: string[];
}

export interface KnowledgeNode {
  type: "file" | "dir";
  name: string;
  summary?: string;
  frontmatter?: Frontmatter;
  body?: string;
  children?: KnowledgeNode[];
  path?: string;
  depth?: number;
  synthetic?: "summary";
  dirPath?: string;
}

export interface KnowledgeTree {
  brand: string;
  root: {
    path: string;
    name: string;
    summary: string;
    children: KnowledgeNode[];
  };
}

export interface Skill {
  name: string;
  description: string;
}

export interface Config {
  model: string;
  provider: string;
  user: string;
  org: string;
}

export interface ChatHistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatRequest {
  question: string;
  history: ChatHistoryTurn[];
}

export type ChatEvent =
  | { kind: "say_start" }
  | { kind: "say_chunk"; text: string }
  | { kind: "say_end" }
  | { kind: "read"; path: string }
  | { kind: "think"; text: string }
  | { kind: "search"; query: string; section?: string }
  | { kind: "skill_list" }
  | { kind: "skill_read"; name: string; desc: string }
  | { kind: "sources"; paths: string[] }
  | { kind: "error"; text: string };

export interface TraceStep {
  kind: "read" | "think" | "search" | "skill";
  path?: string;
  text?: string;
  query?: string;
  section?: string;
  name?: string;
  desc?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  trace?: TraceStep[];
  running?: boolean;
  streaming?: boolean;
  elapsed?: number;
  citeMap?: Record<string, string>;
  sources?: string[];
}
