# Meridian Assistant

An AI-powered virtual assistant with knowledge base navigation, skill execution, and conversational chat powered by DSPy.

---

## Architecture

- **Backend:** FastAPI server (`backend/`) serving REST and SSE APIs
- **Frontend:** React + TypeScript SPA (`frontend/`) built with Vite
- **Knowledge:** Structured markdown files in `knowledge/`
- **Skills:** Python scripts in `skills/`

### Directory Structure

```
.
├── backend/              # FastAPI server
│   ├── utils/           # Shared utilities (llm, tracing)
│   ├── knowledge/       # Knowledge base logic
│   ├── skills/          # Skills registry
│   ├── server.py        # FastAPI app and routes
│   └── dspy_agent.py    # DSPy agent implementation
├── frontend/            # React + TypeScript SPA
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── types/       # TypeScript type definitions
│   │   └── utils/       # Frontend utilities
│   └── vite.config.ts   # Vite configuration
├── knowledge/           # Markdown knowledge base
├── skills/              # Python skill scripts
├── tests/               # Backend tests
└── archive/             # Legacy files (old single-page HTML)
```

---

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- `uv` (Python package manager) or `pip`

### Backend

From project root:

```bash
# Install dependencies
uv sync
# or: pip install -r requirements.txt

# Run backend server
uvicorn backend.server:app --reload --port 8000
```

The backend will be available at http://localhost:8000

### Frontend

From project root:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:5173

Visit http://localhost:5173 to use the application.

---

## API Endpoints

### Backend API (port 8000)

- **GET** `/api/health` — Health check
- **GET** `/api/knowledge/tree` — Knowledge directory structure as JSON tree
- **GET** `/api/knowledge/file?path=...` — Individual knowledge file content
- **GET** `/api/skills` — Available skills with descriptions
- **POST** `/api/chat` — Chat with SSE streaming (body: `{message: string, config?: object}`)

### Frontend Dev Server (port 5173)

Vite development server with hot module replacement.

---

## Testing

### Backend Tests

```bash
pytest
```

### Frontend Tests

```bash
cd frontend
npm test
```

### Integration Testing

See `frontend/INTEGRATION_TEST_RESULTS.md` for comprehensive test results.

---

## Environment Variables

### Backend

- `CORS_ORIGINS` — Comma-separated allowed origins (default: `http://localhost:5173,http://localhost:8000`)
- `ANTHROPIC_API_KEY` — Required for LLM functionality
- `ARIZE_SPACE_KEY` — Optional, for observability tracing
- `ARIZE_API_KEY` — Optional, for observability tracing

### Frontend

- `VITE_API_BASE_URL` — Backend API URL (default: `http://localhost:8000`)

---

## Production Build

### Backend

The backend is a standard FastAPI application. Deploy with:

```bash
uvicorn backend.server:app --host 0.0.0.0 --port 8000
```

### Frontend

Build the frontend for production:

```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/` and can be served by any static file server or CDN.

---

## Skills

Skills are Python scripts that the agent can discover and execute dynamically. Each skill is a directory in `skills/` containing a `SKILL.md` file with YAML frontmatter describing the skill.

### Adding a New Skill

1. Create `skills/<your-skill>/SKILL.md`
2. Add YAML frontmatter:

```yaml
---
name: your-skill
description: "One-line description for the agent."
---
```

3. Write instructions in Markdown
4. The skill will be automatically discovered and available in the UI

---

## Knowledge Base

The knowledge base is a hierarchical collection of Markdown files in `knowledge/`. Each directory can contain:

- `index.md` — Folder summary with YAML frontmatter
- Other `.md` files — Knowledge documents
- Subdirectories — Nested knowledge organization

The frontend provides an interactive tree view for browsing and the backend provides full-text access for the agent.

---

## Architecture Documentation

For detailed architecture information, see:

- `docs/ARCHITECTURE.md` — System architecture and design decisions
- `docs/superpowers/specs/` — Feature specifications
- `docs/superpowers/plans/` — Implementation plans

---

## License

[Your license here]
