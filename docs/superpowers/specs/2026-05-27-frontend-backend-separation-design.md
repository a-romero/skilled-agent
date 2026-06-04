# Frontend/Backend Separation Design

Date: 2026-05-27
Topic: Frontend/Backend separation for Meridian / Open Virtual Assistant

## 1. Goals

- Separate the current single-page HTML+inline React app (Open Virtual Assistant.html) from the FastAPI backend.
- Introduce a modern, TypeScript-based React frontend with a proper bundler (Vite).
- Keep the existing FastAPI backend as the API layer, with clean REST-ish endpoints.
- Support separate deployments (frontend and backend run as independent services).
- Preserve current functionality and UX: chat, streaming responses, knowledge tree, skills panel, citations, etc.

## 2. High-Level Architecture

### 2.1. Monorepo Layout

Convert the current repo into a simple monorepo with two top-level apps:

```text
project-root/
  backend/      # FastAPI app (existing Python code, slightly reorganized)
  frontend/     # New React + TypeScript app (Vite)
  knowledge/    # Existing knowledge base
  skills/       # Existing skills
  docs/         # Superpowers design/specs, etc.
  README.md
  pyproject.toml (backend deps)
```

Existing Python files (server.py, dspy_agent.py, etc.) are moved into `backend/` with imports updated accordingly.

### 2.2. Runtime Topology (Option A – Separate Deployments)

- **Backend service (FastAPI)**
  - Runs on `http://localhost:8000` in dev.
  - Owns all API endpoints and business logic.
  - No longer serves the React HTML shell; only serves API and optionally static docs.

- **Frontend service (Vite + React TS)**
  - Runs on `http://localhost:5173` in dev.
  - Talks to backend via `VITE_API_BASE_URL` env (e.g. `http://localhost:8000`).
  - Built as static files for production (`frontend/dist`), which can be deployed to any static host (or served behind a reverse proxy in front of the backend).

### 2.3. Communication Pattern

- The frontend communicates with the backend using:
  - `fetch`/XHR for JSON endpoints (config, knowledge, skills).
  - `EventSource` / Server-Sent Events (SSE) for streaming chat (`/api/chat`).
- CORS is enabled on the backend to allow the frontend origin in dev.

## 3. Backend Design (FastAPI)

### 3.1. Code Organisation

Target structure under `backend/`:

```text
backend/
  server.py              # FastAPI app entrypoint (main)
  api/
    __init__.py
    routes/
      __init__.py
      chat.py           # /api/chat endpoints
      knowledge.py      # /api/knowledge/* endpoints
      skills.py         # /api/skills endpoints
      config.py         # /api/config and /api/health
    models/
      __init__.py
      chat.py           # Pydantic models for chat requests/responses
      knowledge.py      # Pydantic models for knowledge tree
      skills.py         # Pydantic models for skills
  utils/
    __init__.py
    llm.py              # LLM abstraction / client utils
    arize_tracing.py    # Tracing / observability helpers
  knowledge/
    __init__.py
    knowledge.py        # Core knowledge access functions
    knowledge_graph.py  # Knowledge graph integration
    enrich_knowledge.py # Knowledge enrichment scripts
  skills/
    __init__.py
    skills.py           # Skill registry and helpers
  dspy_agent.py
  pyproject.toml        # backend deps (existing root pyproject logically belongs here)
```

In the first iteration, we can keep most functionality in `server.py` and introduce `api/models` gradually; the structure above is the direction of travel.

### 3.2. API Surface

The backend will expose the following endpoints (some already exist):

- `GET /api/config`
  - Returns runtime configuration needed by the frontend.
  - Payload (example):
    ```json
    {
      "model": "claude-3-5-sonnet",
      "provider": "anthropic",
      "user": "Meridian User",
      "org": "Meridian"
    }
    ```

- `GET /api/health`
  - Simple health check endpoint returning status and optional details.
  - Example:
    ```json
    { "status": "ok" }
    ```

- `GET /api/knowledge/tree` (already implemented)
  - Returns full knowledge tree as JSON, using existing `build_knowledge_tree()`.

- `GET /api/knowledge/file?path=<relative-path>` (new)
  - Returns a specific knowledge file’s parsed contents.
  - Response structure:
    ```json
    {
      "path": "business/group-life/index.md",
      "frontmatter": {
        "url": "https://...",
        "title": "Group Life Insurance",
        "summary": "...",
        "topics": ["group", "life"],
        "keywords": ["group life", "death in service"]
      },
      "body": "# Group Life..."
    }
    ```
  - This aligns with the current frontend expectations (frontmatter + body), allowing the frontend to re-render the preview.

- `GET /api/skills` (already implemented)
  - Returns a list of skills:
    ```json
    [
      { "name": "search_knowledge_graph", "description": "..." },
      { "name": "read_knowledge", "description": "..." }
    ]
    ```

- `POST /api/chat` (already implemented)
  - Accepts JSON body:
    ```json
    {
      "question": "What is group life insurance?",
      "history": [
        { "role": "user", "text": "..." },
        { "role": "assistant", "text": "..." }
      ]
    }
    ```
  - Returns an SSE stream (media type `text/event-stream`) with JSON events encoded as `data: { ... }\n\n`.
  - Event kinds (current behaviour):
    - `"read"`: knowledge read events (`{"kind":"read","path":"..."}`)
    - `"search"`: knowledge graph search events
    - `"skill"`: skill usage events
    - `"say_start"`: begin answer streaming
    - `"say_chunk"`: partial answer text (`{"kind":"say_chunk","text":"..."}`)
    - `"say_end"`: end of answer
    - `"sources"`: list of knowledge-relative `index.md` paths
    - `"error"`: error message

This endpoint remains SSE-based to match the existing streaming UI.

### 3.3. CORS and Config

- Enable CORS on FastAPI app to support separate frontend origin:
  - Allow origins: `http://localhost:5173` (and `http://localhost:8000` for local integration tests).
  - Allow methods: `GET, POST, OPTIONS`.
  - Allow headers: `*`.

- Environment variables (backend):
  - `LLM_MODEL`, `LLM_PROVIDER` (already used).
  - `OVA_USER`, `OVA_ORG` (already used in `/api/config`).
  - Optional: `CORS_ORIGINS` (comma-separated) to override defaults.

## 4. Frontend Design (React + TypeScript)

### 4.1. Tooling

- Bundler: **Vite** (React + TypeScript template).
- Language: **TypeScript** for stronger typing across components and API usage.
- Styling: Extract current CSS from `Open Virtual Assistant.html` into `.css` (or `.scss`) files under `frontend/src/styles/` and import into top-level components.
- State management: React hooks + local component state; optional `React.Context` for global pieces (config, theme, chat state).

### 4.2. Project Structure

```text
frontend/
  index.html
  vite.config.ts
  tsconfig.json
  package.json
  src/
    main.tsx          # React entrypoint
    App.tsx           # Main layout
    styles/
      meridian.css    # Extracted existing CSS
    components/
      layout/
        Brand.tsx
        HistorySidebar.tsx
      knowledge/
        KnowledgePane.tsx
        KnowledgeTree.tsx
        FilePreview.tsx
      chat/
        ChatPane.tsx
        Message.tsx
        Trace.tsx
        Suggestions.tsx
        Composer.tsx
        Sources.tsx
      skills/
        SkillsPanel.tsx
      shared/
        Icon.tsx
        Breadcrumb.tsx
        MarkdownRenderer.tsx
    hooks/
      useConfig.ts
      useKnowledge.ts
      useChat.ts
      useSkills.ts
    services/
      api.ts          # API client (typed wrappers around fetch/EventSource)
    types/
      api.ts          # Shared TypeScript types matching backend models
    utils/
      markdown.ts     # Markdown parsing/rendering helpers, if not in component
      knowledge.ts    # flatten/resolve helpers
```

### 4.3. App-Level State

- **Config** (`useConfig`):
  - Fetched once from `/api/config` on app mount.
  - Holds `model`, `provider`, `user`, `org`.

- **Knowledge** (`useKnowledge`):
  - Fetches `/api/knowledge/tree` on mount.
  - Stores tree, `expandedPaths`, `selectedPath`, `searchQuery`, `readingPath`, and `readInTurn` set.
  - Exposes `resolvePath` and `flatten` helpers (ported from current inline JS).

- **Chat** (`useChat`):
  - Maintains `messages` array (user + assistant messages).
  - Maintains `streamingMessage` state (current assistant response segments).
  - Connects to SSE `/api/chat`:
    - On `say_start`: create new assistant message placeholder with empty text.
    - On `say_chunk`: append to current assistant message text.
    - On `say_end`: mark streaming false.
    - On `read/search/skill`: push trace steps into the assistant message.
    - On `sources`: attach sources paths to the assistant message.
    - On `error`: show error message.
  - Exposes `sendQuestion(question: string)` that posts to `/api/chat` and manages EventSource lifecycle.

- **Skills** (`useSkills`):
  - Fetch `/api/skills` once and keep in memory.
  - Derive which skills were used in the current turn from chat trace events.

### 4.4. UI Components Mapping

We keep visual/interaction patterns from the existing HTML/JS:

- `Brand`: top-left brand section.
- `HistorySidebar`: left pane with new chat button and (optionally) conversation history (for now still local-only; future extension could persist).
- `KnowledgePane` + `KnowledgeTree` + `FilePreview`: middle pane showing knowledge tree and preview. Behaviour mirrors current inline React: highlighting read nodes, summary synthetic nodes, hover popovers, etc.
- `ChatPane`:
  - Header with model/provider info and status pill.
  - `Suggestions` component for quick-start questions.
  - `Message` renders:
    - `Trace` component for reasoning steps, as in current UI.
    - Markdown answer with inline citations (`[1]`, `[2]`) that map to `Sources` block.
- `SkillsPanel`: bottom panel showing skills and which were used in the last turn.
- `Composer`: text area + send button, disabled while a question is in-flight.

### 4.5. API Client (`services/api.ts`)

Create a small API layer to centralise base URL & typing:

- `const API_BASE = import.meta.env.VITE_API_BASE_URL || "";`

Methods (examples):

- `getConfig(): Promise<Config>`
- `getKnowledgeTree(): Promise<KnowledgeTree>`
- `getSkills(): Promise<Skill[]>`
- `startChatStream(payload: ChatRequest): EventSource` (returns an EventSource instance; caller wires up event handlers).

### 4.6. Environment & Build

- Dev:
  - Backend: `uv run uvicorn backend.server:app --reload --port 8000`.
  - Frontend: `cd frontend && npm run dev`.
  - `.env.development` in `frontend/`:
    ```env
    VITE_API_BASE_URL=http://localhost:8000
    ```

- Prod:
  - `npm run build` → `frontend/dist/`.
  - `VITE_API_BASE_URL` can be set to e.g. `/api` if frontend is served behind a proxy on same domain.

## 5. Data Contracts / Types

We define shared types (mirroring backend models) in `frontend/src/types/api.ts`:

- `Config`, `KnowledgeNode`, `KnowledgeTree`, `Skill`, `ChatHistoryTurn`, `ChatEvent`, `ChatRequest`.
- Ensure these match FastAPI response models to avoid drift.

Example (simplified):

```ts
export interface Skill {
  name: string;
  description: string;
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
  | { kind: "search"; query: string; section?: string }
  | { kind: "skill"; name: string; desc: string }
  | { kind: "sources"; paths: string[] }
  | { kind: "error"; text: string };
```

## 6. Error Handling & UX

- Frontend shows clear messages on:
  - Network errors (config, knowledge tree, skills, chat).
  - SSE failures (connection dropped, parse errors).
- Disable composer while a chat request is in progress to avoid overlapping EventSource connections (for now).
- Show lightweight loader indicators (status pill, streaming caret).

## 7. Testing Strategy

- **Backend**:
  - Expand existing `tests/test_server.py` for new endpoints and CORS behaviour.
  - Add tests for `/api/knowledge/file` if implemented.

- **Frontend** (initial, minimal):
  - At least smoke tests for `App` and key hooks/components using Vitest/React Testing Library.
  - Manual verification of SSE streaming and knowledge interactions in dev.

## 8. Migration Plan (Stepwise)

1. **Repo reorganisation**
   - Create `backend/` directory and move Python files there.
   - Adjust imports and update run command (`uvicorn backend.server:app ...`).

2. **Backend adjustments**
   - Ensure CORS is correctly configured for `http://localhost:5173`.
   - Keep existing `/api/*` endpoints behaviour intact.
   - Optionally add `/api/health` and `/api/knowledge/file` for completeness.

3. **Frontend scaffolding**
   - Create `frontend/` via `npm create vite@latest` (React + TS template).
   - Extract CSS from `Open Virtual Assistant.html` into `meridian.css`.
   - Create initial components with the current HTML structure but static data.

4. **Wire up APIs**
   - Implement `services/api.ts` and hooks (`useConfig`, `useKnowledge`, `useSkills`, `useChat`).
   - Replace static data with fetched data and SSE streams.

5. **Parity & cleanup**
   - Ensure new frontend matches existing behaviour and visual style.
   - Remove old `Open Virtual Assistant.html` once new frontend is adopted.

---

This design is intended to be concrete enough to guide implementation while still allowing small adjustments during development.
