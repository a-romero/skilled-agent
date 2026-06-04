# Meridian Assistant Architecture

This document describes the system architecture of the Meridian Assistant after the frontend/backend separation (May 2026).

---

## Overview

Meridian Assistant is a conversational AI application built with:

- **Backend:** FastAPI serving REST + SSE APIs
- **Frontend:** React + TypeScript SPA built with Vite
- **Agent:** DSPy-powered conversational agent with dynamic skill loading
- **Knowledge:** Markdown-based hierarchical knowledge base
- **Skills:** Python scripts discoverable by the agent

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          React + TypeScript Frontend (Vite)            │ │
│  │                                                          │ │
│  │  Components:                                            │ │
│  │  • KnowledgePane  → Browse knowledge tree              │ │
│  │  • ChatPane       → Conversational interface           │ │
│  │  • SkillsPanel    → Configure available skills         │ │
│  │                                                          │ │
│  │  Hooks:                                                 │ │
│  │  • useKnowledge   → Fetch & manage knowledge state     │ │
│  │  • useChat        → SSE streaming & message history    │ │
│  │  • useSkills      → Skills list                        │ │
│  │  • useConfig      → Chat configuration                 │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP/SSE
                        │ (localhost:5173 → localhost:8000)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    API Routes                           │ │
│  │  • GET  /api/health           → Health check           │ │
│  │  • GET  /api/knowledge/tree   → Knowledge structure    │ │
│  │  • GET  /api/knowledge/file   → File content           │ │
│  │  • GET  /api/skills           → Available skills       │ │
│  │  • POST /api/chat             → SSE chat stream        │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────┼────────────────────────────────┐│
│  │         DSPy Agent     │    Knowledge      Skills       ││
│  │      (dspy_agent.py)   │   (knowledge/)  (skills/)      ││
│  │                        │                                ││
│  │  • Orchestrates LLM    │  • read_knowledge_file()       ││
│  │  • Loads skills        │  • build_tree()                ││
│  │  • Reasoning traces    │  • KnowledgeGraph              ││
│  │  • Citations           │                                ││
│  └────────────────────────┴────────────────────────────────┘│
│                           │                                  │
│  ┌────────────────────────┼────────────────────────────────┐│
│  │           Utils        │                                ││
│  │       (utils/)         │                                ││
│  │  • llm.py             → LLM provider abstraction        ││
│  │  • arize_tracing.py   → Observability                   ││
│  └────────────────────────┴────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │   External Services │
              │  • Anthropic API    │
              │  • Arize Phoenix    │
              └─────────────────────┘
```

---

## Backend Architecture

### Directory Structure

```
backend/
├── __init__.py
├── server.py              # FastAPI app and route handlers
├── dspy_agent.py          # DSPy agent loop with skill loading
├── utils/                 # Shared utilities
│   ├── __init__.py
│   ├── llm.py            # LLM provider abstraction (Anthropic, etc.)
│   └── arize_tracing.py  # OpenTelemetry tracing setup
├── knowledge/            # Knowledge base logic
│   ├── __init__.py
│   ├── knowledge.py      # Knowledge file reading
│   ├── knowledge_graph.py # Graph building & retrieval
│   └── enrich_knowledge.py # Knowledge enrichment utilities
└── skills/               # Skills registry
    ├── __init__.py
    └── skills.py         # Skill discovery and loading
```

### Key Modules

#### `server.py`
- FastAPI application entrypoint
- CORS middleware configuration
- Route handlers for knowledge, skills, and chat APIs
- SSE streaming setup for chat

#### `dspy_agent.py`
- DSPy agent implementation
- Lazy skill loading from filesystem
- Reasoning trace extraction
- Citation generation

#### `utils/llm.py`
- Abstraction over LLM providers (Anthropic, OpenAI, etc.)
- Unified interface: `get_llm_provider()`

#### `knowledge/knowledge.py`
- Knowledge file reading with YAML frontmatter parsing
- Knowledge tree building (`build_knowledge_tree()`)
- File content retrieval (`read_knowledge_file()`)

#### `skills/skills.py`
- Skill discovery from `skills/` directory
- SKILL.md parsing (YAML frontmatter + instructions)
- Skill registry building (`build_skill_registry()`)

---

## Frontend Architecture

### Directory Structure

```
frontend/
├── src/
│   ├── main.tsx           # App entrypoint
│   ├── App.tsx            # Root component with layout
│   ├── components/        # React components by feature
│   │   ├── chat/
│   │   │   ├── ChatPane.tsx
│   │   │   ├── ChatMessages.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── ReasoningTrace.tsx
│   │   │   └── CitationLink.tsx
│   │   ├── knowledge/
│   │   │   ├── KnowledgePane.tsx
│   │   │   ├── KnowledgeTree.tsx
│   │   │   └── FilePreview.tsx
│   │   ├── skills/
│   │   │   └── SkillsPanel.tsx
│   │   └── shared/
│   │       ├── Icon.tsx
│   │       └── MarkdownRenderer.tsx
│   ├── hooks/             # Custom React hooks
│   │   ├── useKnowledge.ts
│   │   ├── useChat.ts
│   │   ├── useSkills.ts
│   │   └── useConfig.ts
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts
│   └── utils/             # Frontend utilities
│       └── api.ts         # API client functions
├── index.html
├── vite.config.ts
└── package.json
```

### Component Hierarchy

```
App
├── KnowledgePane (left sidebar)
│   ├── KnowledgeTree
│   │   └── TreeNode (recursive)
│   └── FilePreview
│       └── MarkdownRenderer
├── ChatPane (center)
│   ├── ChatMessages
│   │   ├── MessageBubble
│   │   ├── ReasoningTrace
│   │   └── CitationLink
│   └── ChatInput
└── SkillsPanel (right sidebar, collapsible)
    └── SkillsList
```

### State Management

State is managed via custom React hooks:

#### `useKnowledge`
```typescript
{
  tree: KnowledgeNode | null,
  selectedFile: KnowledgeFile | null,
  isLoading: boolean,
  error: string | null,
  selectFile: (path: string) => Promise<void>,
  refresh: () => Promise<void>
}
```

#### `useChat`
```typescript
{
  messages: Message[],
  isStreaming: boolean,
  error: string | null,
  sendMessage: (text: string, config: ChatConfig) => Promise<void>,
  clearMessages: () => void
}
```

#### `useSkills`
```typescript
{
  skills: Skill[],
  isLoading: boolean,
  error: string | null
}
```

#### `useConfig`
```typescript
{
  config: ChatConfig,
  updateConfig: (updates: Partial<ChatConfig>) => void,
  resetConfig: () => void
}
```

---

## API Contracts

### Knowledge API

#### `GET /api/knowledge/tree`
Returns the full knowledge directory structure as a nested tree.

**Response:**
```json
{
  "name": "knowledge",
  "type": "directory",
  "path": "",
  "children": [
    {
      "name": "investments",
      "type": "directory",
      "path": "investments",
      "children": [...]
    },
    {
      "name": "pensions",
      "type": "directory",
      "path": "pensions",
      "children": [...]
    }
  ]
}
```

#### `GET /api/knowledge/file?path=investments/index.md`
Returns the content of a specific knowledge file.

**Response:**
```json
{
  "path": "investments/index.md",
  "content": "...",
  "frontmatter": {
    "title": "Investments",
    "description": "Investment products and strategies"
  }
}
```

### Skills API

#### `GET /api/skills`
Returns all available skills.

**Response:**
```json
[
  {
    "name": "python-coder",
    "description": "Write and execute Python code"
  },
  {
    "name": "web-search",
    "description": "Search the web for information"
  }
]
```

### Chat API

#### `POST /api/chat`
Starts a chat session with SSE streaming.

**Request:**
```json
{
  "message": "What are ISAs?",
  "config": {
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.0,
    "max_tokens": 8000,
    "enabled_skills": ["web-search", "python-coder"]
  }
}
```

**Response:** Server-Sent Events stream

Event types:
- `start` — Chat started
- `reasoning` — Reasoning trace chunk
- `response` — Assistant response chunk
- `citation` — Knowledge citation
- `error` — Error occurred
- `done` — Stream complete

Example events:
```
event: start
data: {"timestamp": "2024-05-27T10:00:00Z"}

event: reasoning
data: {"content": "I need to search for information about ISAs..."}

event: response
data: {"content": "An ISA (Individual Savings Account) is..."}

event: citation
data: {"path": "investments/isas.md", "title": "ISAs Overview"}

event: done
data: {}
```

---

## Data Flow

### Knowledge Browsing

```
User clicks folder
    ↓
KnowledgeTree updates selection
    ↓
useKnowledge.selectFile(path)
    ↓
GET /api/knowledge/file?path=...
    ↓
backend.knowledge.read_knowledge_file()
    ↓
Parse YAML frontmatter + markdown
    ↓
Return to frontend
    ↓
FilePreview renders with MarkdownRenderer
```

### Chat Message Flow

```
User types message + clicks send
    ↓
ChatInput calls sendMessage(text, config)
    ↓
useChat opens EventSource connection
    ↓
POST /api/chat with SSE
    ↓
backend.server.chat_stream()
    ↓
dspy_agent.run_agent_stream()
    ↓
  • Load enabled skills
  • Call LLM with tools
  • Extract reasoning traces
  • Generate citations
    ↓
Stream events back to frontend
    ↓
useChat updates messages state
    ↓
ChatMessages re-renders with new content
```

---

## Development Workflow

### Backend Development

1. Make changes to Python files in `backend/`
2. Backend auto-reloads (via `--reload` flag)
3. Test with `pytest`
4. Check types with `mypy backend/` (if configured)

### Frontend Development

1. Make changes to TypeScript/React files in `frontend/src/`
2. Vite HMR updates browser instantly
3. Test with `npm test`
4. Check types with `npm run typecheck`
5. Lint with `npm run lint`

### Integration Testing

See `frontend/INTEGRATION_TEST_RESULTS.md` for the full integration test checklist and results.

Key integration points to test:
- Knowledge tree loading and file preview
- Chat message sending and SSE streaming
- Reasoning traces display
- Citation links navigation
- Skills toggle and configuration
- Error handling and loading states

---

## Deployment Considerations

### Backend Deployment

- **ASGI Server:** Use `uvicorn` or `gunicorn` with uvicorn workers
- **Environment:** Set `CORS_ORIGINS` to your frontend domain
- **Secrets:** Set `ANTHROPIC_API_KEY` securely
- **Observability:** Configure Arize/Phoenix for tracing (optional)

Example production command:
```bash
uvicorn backend.server:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend Deployment

- **Build:** `npm run build` → outputs to `frontend/dist/`
- **Serve:** Any static file server (Nginx, Apache, Vercel, Netlify, etc.)
- **Environment:** Set `VITE_API_BASE_URL` to your backend URL at build time

Example with Nginx:
```nginx
server {
  listen 80;
  server_name your-domain.com;
  root /var/www/meridian/frontend/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://localhost:8000;
  }
}
```

### Separate Deployments (Recommended)

Deploy backend and frontend to separate services/domains:

- Backend: `api.meridian.com` (API server)
- Frontend: `meridian.com` (static site)

Configure CORS on the backend to allow the frontend domain.

---

## Design Decisions

### Why Separate Frontend and Backend?

**Previous architecture:** Single HTML file with embedded React via CDN

**New architecture:** Separate TypeScript SPA with proper build tooling

**Benefits:**
- ✅ Proper TypeScript support with IDE autocomplete
- ✅ Build-time optimizations (tree shaking, code splitting)
- ✅ Better component organization and reusability
- ✅ Independent deployment and scaling
- ✅ Modern dev experience (HMR, ESLint, Prettier)
- ✅ Easier testing with Jest + React Testing Library

### Why Vite?

- Fast dev server with instant HMR
- Native ESM support
- Excellent TypeScript integration
- Optimized production builds
- Simple configuration

### Why Custom Hooks Instead of Redux/Zustand?

- Application state is simple and localized
- Each pane manages its own domain (knowledge, chat, skills)
- No complex state synchronization needed
- Reduces bundle size and complexity
- Easy to lift to global state management later if needed

### Why SSE for Chat Streaming?

- Simple, unidirectional streaming from server to client
- Native browser support via EventSource
- Perfect for LLM streaming (tokens + reasoning traces)
- Lighter weight than WebSockets for this use case

---

## Future Enhancements

Potential areas for improvement:

1. **Conversation History Persistence**
   - Store chat history in database
   - Load previous conversations

2. **Real-time Collaboration**
   - Multiple users chatting with same agent
   - Shared knowledge annotations

3. **Knowledge Graph Visualization**
   - Visual representation of knowledge connections
   - Interactive graph exploration

4. **Advanced Skill Management**
   - UI for creating/editing skills
   - Skill versioning and rollback
   - Skill marketplace

5. **Multi-modal Input**
   - Voice input/output
   - Image upload and analysis
   - Document upload

6. **Fine-tuned Models**
   - Custom models trained on knowledge base
   - Domain-specific reasoning

---

## Related Documentation

- **Design Spec:** `docs/superpowers/specs/2026-05-27-frontend-backend-separation-design.md`
- **Implementation Plan:** `docs/superpowers/plans/2026-05-27-frontend-backend-separation-plan.md`
- **Integration Tests:** `frontend/INTEGRATION_TEST_RESULTS.md`
- **API Documentation:** http://localhost:8000/docs (when backend is running)

---

**Last Updated:** 2026-05-27
