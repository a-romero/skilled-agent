# Skilled Agent

An AI agent that combines knowledge base navigation, skill execution, and conversational chat powered by DSPy.

## Overview

Skilled Agent is a framework for building AI assistants with:

- **Dynamic Skill System**: Self-describing Python skills that the agent discovers and executes
- **Knowledge Base Integration**: Hierarchical markdown knowledge repository with semantic search
- **DSPy-Powered Reasoning**: ReAct agent with structured prompting and optimization
- **Web Interface**: React + TypeScript frontend with streaming responses
- **REST API**: FastAPI backend with Server-Sent Events (SSE)
- **Observability**: Tracing and monitoring via Arize Phoenix

### Key Features

- 🧠 **Intelligent Agent**: DSPy signatures and ReAct reasoning loops
- 📚 **Knowledge Navigation**: Semantic search via knowledge graph or fallback to SUMMARY.MD navigation
- 🛠️ **Extensible Skills**: Drop-in Python skills with YAML metadata
- 💬 **Streaming Chat**: Real-time SSE-based responses
- 🔍 **Knowledge Graph**: Vector embeddings for semantic knowledge retrieval
- 📊 **Tracing**: Phoenix integration for LLM call inspection
- 🎨 **UI**: React, TypeScript, and Tailwind CSS

---

## Architecture

Skilled Agent uses a three-tier architecture:

- **Backend:** FastAPI server (`backend/`)
  - DSPy ReAct agent with tool-based reasoning
  - Skill registry with automatic discovery
  - Knowledge base serving and tree structure generation
  - Knowledge graph with semantic search
  - LLM integration (via LiteLLM)
  - Arize tracing
  
- **Frontend:** React + TypeScript SPA (`frontend/`)
  - Knowledge tree browser with markdown rendering
  - Chat interface with streaming responses
  - Skill discovery UI
  - Syntax highlighting
  
- **Knowledge:** Markdown files in `knowledge/`
  - Hierarchical organization with `index.md` files
  - YAML frontmatter for metadata (title, summary, topics, keywords)
  - SUMMARY.MD files for navigation
  - Knowledge graph with vector embeddings
  
- **Skills:** Python scripts in `skills/`
  - YAML frontmatter with name, description, triggers
  - Automatic registration and discovery

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

Skills are self-contained modules that the agent discovers and executes.

### Skill Structure

Each skill is a directory in `skills/` containing:

- `SKILL.md` — Markdown file with YAML frontmatter
- Optional Python modules for complex operations
- Supporting files or resources

### How Skills Work

1. **Discovery**: Backend scans `skills/` for `SKILL.md` files on startup
2. **Registration**: Skills are parsed and registered with metadata
3. **Agent Tools**: Agent has `list_skills_tool` and `read_skill_tool` functions
4. **Execution**: Agent lists skills, reads relevant ones, follows instructions

### Adding a New Skill

1. Create `skills/<your-skill>/SKILL.md`
2. Add YAML frontmatter:

```yaml
---
name: your-skill
description: "One-line description for the agent."
triggers:
  - keyword_pattern
  - use_case_description
---
```

3. Write instructions in Markdown:
   - What the skill does
   - When to use it
   - Step-by-step execution instructions
   - Expected inputs and outputs
   - Error handling

4. Restart backend to load the skill

### Example Skills

See `skills/` for examples:

- **kg-navigation**: Search knowledge graph and read documents
- **summariser**: Format responses with source citations

---

## Knowledge Base

The knowledge base is a hierarchical markdown repository with semantic search capabilities.

### Structure

Each directory in `knowledge/` can contain:

- `index.md` — Main content with YAML frontmatter
- `SUMMARY.MD` — Navigation file listing sections and pages
- Subdirectories — Nested organization

### Knowledge Graph

The knowledge graph enables semantic search across the knowledge base:

- **Vector Embeddings**: Each `index.md` file is embedded using sentence-transformers
- **Semantic Search**: Agent searches by query and optional section scope
- **Metadata**: Uses frontmatter fields (title, summary, topics, keywords)
- **Storage**: ChromaDB vector database in `.knowledge_graph/`

### Enrichment Pipeline

The `enrich_knowledge.py` script prepares the knowledge base:

**Phase 1: Frontmatter Enrichment**
- Scans all `.md` files in `knowledge/`
- Uses Claude to generate `summary`, `topics`, and `keywords` fields
- Only enriches files missing these fields

**Phase 2: SUMMARY.MD Generation**
- Generates navigation files bottom-up through the directory tree
- Each SUMMARY.MD lists child sections and pages with descriptions
- Used as fallback when knowledge graph is unavailable

**Phase 3: Knowledge Graph Population**
- Collects all enriched `index.md` files
- Creates vector embeddings for each page
- Populates ChromaDB with embeddings and metadata

### Running the Pipeline

```bash
# Full pipeline (all phases)
uv run python backend/knowledge/enrich_knowledge.py

# Individual phases
uv run python backend/knowledge/enrich_knowledge.py --phase1-only
uv run python backend/knowledge/enrich_knowledge.py --phase2-only
uv run python backend/knowledge/enrich_knowledge.py --phase3-only

# Preview changes without writing
uv run python backend/knowledge/enrich_knowledge.py --dry-run
```

### How the Agent Uses Knowledge

1. **Search**: Agent searches knowledge graph with natural language queries
2. **Review**: Agent reviews returned titles and summaries (top 5 results)
3. **Read**: Agent reads full content from relevant pages
4. **Fallback**: If graph unavailable, agent navigates via SUMMARY.MD files
5. **Citation**: Agent cites sources with title and URL

### Adding Knowledge

1. Create `.md` file in appropriate `knowledge/` subdirectory
2. Add YAML frontmatter (title is required, others optional):

```yaml
---
title: "Document Title"
summary: "Brief description"
topics: [topic1, topic2]
keywords: [keyword1, keyword2]
url: "https://example.com/source"
---
```

3. Write content in Markdown
4. Run enrichment pipeline to populate graph
5. Restart backend to reload knowledge registry

---

## Architecture Documentation

For detailed architecture information, see:

- `docs/ARCHITECTURE.md` — System architecture and design decisions
- `docs/superpowers/specs/` — Feature specifications
- `docs/superpowers/plans/` — Implementation plans

---

## Contributing

Contributions are welcome! Areas for contribution include:

- **New Skills**: Add capabilities for specific domains or tasks
- **Knowledge Content**: Expand the knowledge base with useful reference material
- **UI Improvements**: Enhance the frontend experience
- **DSPy Optimizations**: Improve agent reasoning and prompt engineering
- **Integrations**: Connect to additional LLM providers or external services

Please see existing code for patterns and conventions.

---

## Roadmap

Upcoming features and improvements:

- [ ] Multi-agent collaboration and task delegation
- [ ] Persistent conversation history and memory
- [ ] Advanced skill chaining and workflows
- [ ] Vector search for semantic knowledge retrieval
- [ ] Web-based skill editor
- [ ] Fine-tuning and DSPy optimization workflows

