# Frontend/Backend Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate the current single-file HTML+inline React UI from the FastAPI backend into a monorepo with a structured backend and a new React+TypeScript frontend, preserving existing functionality.

**Architecture:** Backend becomes a FastAPI service in `backend/` with clear `api/`, `utils/`, `knowledge/`, and `skills/` modules, exposing `/api/*` endpoints and SSE chat. Frontend becomes a Vite-based React+TS app in `frontend/` consuming these APIs via JSON and SSE. The two services are developed and deployed independently.

**Tech Stack:**
- Backend: Python 3.10+, FastAPI, Uvicorn, existing DSPy agent and knowledge tooling
- Frontend: Vite, React, TypeScript, CSS (extracted from existing HTML)
- Testing: pytest for backend, Vitest/React Testing Library for frontend (initial smoke tests)

---

## File & Directory Overview

Final target layout (high level):

```text
project-root/
  backend/
    server.py
    api/
      routes/
      models/
    utils/
      llm.py
      arize_tracing.py
    knowledge/
      knowledge.py
      knowledge_graph.py
      enrich_knowledge.py
    skills/
      skills.py
    dspy_agent.py
    pyproject.toml
  frontend/
    index.html
    vite.config.ts
    tsconfig.json
    package.json
    src/
      main.tsx
      App.tsx
      styles/meridian.css
      components/... (chat, knowledge, skills, shared)
      hooks/
      services/api.ts
      types/api.ts
  knowledge/      # existing content
  skills/         # existing content
  docs/
    superpowers/
      specs/2026-05-27-frontend-backend-separation-design.md
      plans/2026-05-27-frontend-backend-separation-plan.md
  Open Virtual Assistant.html (kept temporarily for reference)
```

---

### Task 1: Create backend/ and move existing backend files

**Files:**
- Move: `server.py` → `backend/server.py`
- Move: `dspy_agent.py` → `backend/dspy_agent.py`
- Move: `knowledge.py` → `backend/knowledge.py`
- Move: `knowledge_graph.py` → `backend/knowledge_graph.py`
- Move: `skills.py` → `backend/skills.py`
- Move: `llm.py` → `backend/llm.py`
- Move: `arize_tracing.py` → `backend/arize_tracing.py`
- Move: `enrich_knowledge.py` → `backend/enrich_knowledge.py`
- Move: `pyproject.toml` → `backend/pyproject.toml`

- [ ] **Step 1: Create backend directory and move files**

```bash
mkdir -p backend
mv server.py dspy_agent.py knowledge.py knowledge_graph.py skills.py llm.py arize_tracing.py enrich_knowledge.py backend/
mv pyproject.toml backend/
```

- [ ] **Step 2: Adjust working directory assumptions if needed**

For now, many modules use `Path(__file__).parent` or relative paths; after moving, they will still resolve relative to `backend/`. Keep this as-is for the moment. Note that tests in `tests/` may import modules by top-level name (e.g. `import server`). We will fix imports in a later task.

- [ ] **Step 3: Update README run instructions**

Edit `README.md` to update any references to running the server, e.g.:

```bash
uv run uvicorn backend.server:app --reload --port 8000
```

Run:

```bash
sed -n '1,120p' README.md
# Manually edit any lines mentioning `uvicorn server:app` to `uvicorn backend.server:app`.
```

Commit after Task 1:

```bash
git add backend README.md
git commit -m "chore: move backend python files into backend directory"
```

---

### Task 2: Introduce backend subpackages (utils, knowledge, skills) and move modules

**Files:**
- Create: `backend/utils/__init__.py`
- Move: `backend/llm.py` → `backend/utils/llm.py`
- Move: `backend/arize_tracing.py` → `backend/utils/arize_tracing.py`
- Create: `backend/knowledge/__init__.py`
- Move: `backend/knowledge.py` → `backend/knowledge/knowledge.py`
- Move: `backend/knowledge_graph.py` → `backend/knowledge/knowledge_graph.py`
- Move: `backend/enrich_knowledge.py` → `backend/knowledge/enrich_knowledge.py`
- Create: `backend/skills/__init__.py`
- Move: `backend/skills.py` → `backend/skills/skills.py`

- [ ] **Step 1: Create new packages and move files**

```bash
mkdir -p backend/utils backend/knowledge backend/skills
touch backend/utils/__init__.py backend/knowledge/__init__.py backend/skills/__init__.py
mv backend/llm.py backend/utils/llm.py
mv backend/arize_tracing.py backend/utils/arize_tracing.py
mv backend/knowledge.py backend/knowledge/knowledge.py
mv backend/knowledge_graph.py backend/knowledge/knowledge_graph.py
mv backend/enrich_knowledge.py backend/knowledge/enrich_knowledge.py
mv backend/skills.py backend/skills/skills.py
```

- [ ] **Step 2: Update imports across backend modules**

Search and replace import paths to reflect the new package structure.

Examples (adjust as actual imports dictate):

- In `backend/dspy_agent.py`, update:

```python
from knowledge import KNOWLEDGE_ROOT, build_source_registry, read_knowledge
from arize_tracing import setup_arize, instrument_dspy, get_tracer
from skills import build_skill_registry, list_skills, read_skill
from knowledge_graph import KnowledgeGraph as _KGClass
```

to:

```python
from backend.knowledge.knowledge import KNOWLEDGE_ROOT, build_source_registry, read_knowledge
from backend.utils.arize_tracing import setup_arize, instrument_dspy, get_tracer
from backend.skills.skills import build_skill_registry, list_skills, read_skill
from backend.knowledge.knowledge_graph import KnowledgeGraph as _KGClass
```

- In `backend/server.py`, update imports similarly, e.g.:

```python
from skills import build_skill_registry
```

becomes:

```python
from backend.skills.skills import build_skill_registry
```

And any imports of `knowledge`, `knowledge_graph`, `llm`, or `arize_tracing` should be updated to `backend.knowledge.*` or `backend.utils.*` as appropriate.

Use `rg` (ripgrep) to locate imports:

```bash
rg "from (knowledge|knowledge_graph|skills|llm|arize_tracing)" backend
```

- [ ] **Step 3: Run tests to validate import changes**

From project root:

```bash
uv run pytest -q
```

Fix any import errors that mention `ModuleNotFoundError` by adjusting the import paths to be fully qualified (`backend.*`). If necessary, add `backend` to `PYTHONPATH` in your test command or configure `pytest` to treat `backend` as a package (e.g., via `__init__.py` and running tests from project root).

Commit after Task 2:

```bash
git add backend
git commit -m "refactor: introduce backend utils, knowledge, and skills packages"
```

---

### Task 3: Adjust FastAPI server entrypoint and keep API behaviour

**Files:**
- Modify: `backend/server.py`
- Modify: `backend/pyproject.toml` (if any script entrypoints exist)

- [ ] **Step 1: Confirm FastAPI app configuration still works**

Open `backend/server.py` and ensure the `FastAPI` app is instantiated as `app` and still mounts static files and CORS middleware. The file should start roughly like:

```python
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from backend.skills.skills import build_skill_registry

_HERE = Path(__file__).parent
...
app = FastAPI(title="Meridian Assistant")
...
```

- [ ] **Step 2: Update any static paths to reflect backend location**

`_HERE = Path(__file__).parent` should now point to `backend/`. References like `KNOWLEDGE_ROOT = _HERE / "knowledge"` may need to be changed to point at the top-level `knowledge/` directory instead of a `backend/knowledge` folder if that is the intended data location.

For example, change:

```python
KNOWLEDGE_ROOT = _HERE / "knowledge"
```

to:

```python
KNOWLEDGE_ROOT = (_HERE / ".." / "knowledge").resolve()
```

Do the same for any other references that expect `knowledge` at the repo root. Ensure `HTML_FILE` (for `Open Virtual Assistant.html`) is still pointing at the root for now:

```python
HTML_FILE = (_HERE / ".." / "Open Virtual Assistant.html").resolve()
```

- [ ] **Step 3: Verify dev server runs**

From project root:

```bash
uv run uvicorn backend.server:app --reload --port 8000
```

Visit `http://localhost:8000/` to confirm the current HTML-based frontend still loads and functions as before (we will later move to the new frontend). Stop the server once confirmed.

Commit after Task 3:

```bash
git add backend
git commit -m "chore: fix backend paths after restructuring"
```

---

### Task 4: Add /api/health and optional /api/knowledge/file endpoints

**Files:**
- Modify: `backend/server.py` (for now; later could be moved into `backend/api/routes/`)

- [ ] **Step 1: Implement /api/health**

Add the following endpoint to `backend/server.py`:

```python
from fastapi import status


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}
```

This is a simple healthcheck for the frontend and monitoring.

- [ ] **Step 2: Implement /api/knowledge/file (optional but useful)**

If you choose to implement the file endpoint now, add:

```python
from fastapi import HTTPException, Query

from backend.knowledge.knowledge import read_knowledge_file  # you may need to implement this helper


@app.get("/api/knowledge/file")
async def knowledge_file(path: str = Query(..., description="Knowledge-relative path, e.g. 'business/group-life/index.md'")) -> dict:
    try:
        return read_knowledge_file(path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Knowledge file not found")
```

You will need to implement `read_knowledge_file` in `backend/knowledge/knowledge.py` to return a dict with `path`, `frontmatter`, and `body`, similar to how `_parse_index_md` and `_build_tree` work in `backend/server.py`. A minimal implementation can reuse `_parse_index_md` and path resolution, but keep it simple for now.

- [ ] **Step 3: Add backend tests for new endpoints**

In `tests/test_server.py`, add tests such as:

```python
from httpx import AsyncClient

from backend.server import app


async def test_health_endpoint():
    async with AsyncClient(app=app, base_url="http://testserver") as ac:
        resp = await ac.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
```

If you implemented `/api/knowledge/file`, add a test for a known file path as well.

Run tests:

```bash
uv run pytest tests/test_server.py -q
```

Commit after Task 4:

```bash
git add backend tests/test_server.py
git commit -m "feat: add health endpoint and knowledge file API"
```

---

### Task 5: Refine CORS configuration for separate frontend

**Files:**
- Modify: `backend/server.py`
- Optionally modify: `backend/.env` or root `.env` to add `CORS_ORIGINS`

- [ ] **Step 1: Adjust CORS origins to be env-configurable**

In `backend/server.py`, where `CORSMiddleware` is configured, update it to read allowed origins from an environment variable with a sensible default.

Example:

```python
import os

from fastapi.middleware.cors import CORSMiddleware


def _get_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS")
    if not raw:
        # Default for local dev: frontend on 5173, backend on 8000
        return ["http://localhost:5173", "http://localhost:8000"]
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(title="Meridian Assistant")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 2: Verify CORS behaviour**

Start the backend:

```bash
uv run uvicorn backend.server:app --reload --port 8000
```

Use a simple curl or HTTP client to check that CORS headers are present, e.g.:

```bash
curl -i -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  http://localhost:8000/api/chat
```

Confirm the response contains `Access-Control-Allow-Origin: http://localhost:5173`.

Commit after Task 5:

```bash
git add backend/server.py
git commit -m "chore: configure CORS for separate frontend origin"
```

---

### Task 6: Scaffold the React + TypeScript frontend using Vite

**Files:**
- Create directory: `frontend/`
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html`
- Create: `frontend/src/main.tsx`, `frontend/src/App.tsx`

- [ ] **Step 1: Scaffold Vite React+TS app**

From project root:

```bash
cd /path/to/project-root
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

This will create a new `frontend/` directory with a standard React+TS Vite setup.

- [ ] **Step 2: Configure API base URL env variable**

Create `frontend/.env.development` with:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Ensure `frontend/vite.config.ts` has no special proxying for now.

- [ ] **Step 3: Verify dev server runs**

Run:

```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` to confirm the starter Vite React page appears.

Commit after Task 6:

```bash
cd /path/to/project-root
git add frontend
git commit -m "chore: scaffold React+TypeScript frontend with Vite"
```

---

### Task 7: Extract CSS from Open Virtual Assistant.html into frontend styles

**Files:**
- Create: `frontend/src/styles/meridian.css`
- Modify: `frontend/src/main.tsx` or `frontend/src/App.tsx` to import styles
- Keep: `Open Virtual Assistant.html` (reference only, not served in production)

- [ ] **Step 1: Copy CSS into a dedicated stylesheet**

Open `Open Virtual Assistant.html` and copy the entire `<style>...</style>` block into a new file:

```bash
mkdir -p frontend/src/styles
# Then paste CSS content into:
# frontend/src/styles/meridian.css
```

- [ ] **Step 2: Import CSS into React entrypoint**

In `frontend/src/main.tsx`, import the CSS file:

```ts
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/meridian.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Ensure basic layout mounts**

Replace the default `App.tsx` with a minimal layout placeholder using existing classes, for example:

```tsx
function App() {
  return (
    <div className="app">
      <div className="pane">Left pane placeholder</div>
      <div className="pane">Middle pane placeholder</div>
      <div className="pane chat">Chat pane placeholder</div>
    </div>
  );
}

export default App;
```

Run `npm run dev` and confirm the layout looks roughly like the original UI (but with placeholders).

Commit after Task 7:

```bash
cd /path/to/project-root
git add frontend/src/styles/meridian.css frontend/src/main.tsx frontend/src/App.tsx
git commit -m "feat: add Meridian UI styles and basic layout skeleton"
```

---

### Task 8: Port shared components (Icon, markdown renderer, knowledge utils) to TypeScript

**Files:**
- Create: `frontend/src/components/shared/Icon.tsx`
- Create: `frontend/src/components/shared/MarkdownRenderer.tsx`
- Create: `frontend/src/utils/knowledge.ts`
- Create: `frontend/src/types/api.ts`

- [ ] **Step 1: Implement Icon component**

Port the existing `Icon` React component from the HTML inline script into `frontend/src/components/shared/Icon.tsx` with TypeScript types.

Example:

```tsx
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
    // ...port the remaining cases exactly from the existing implementation...
    default:
      return null;
  }
};
```

Fill in the other cases using the existing JSX.

- [ ] **Step 2: Implement MarkdownRenderer**

Port `renderMarkdown` and `renderInline` into a `MarkdownRenderer` component or utility. For example:

```tsx
import React from "react";

export interface CiteMap {
  [key: string]: string;
}

interface MarkdownRendererProps {
  source: string;
  citeMap?: CiteMap;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ source, citeMap }) => {
  // Port the renderMarkdown logic here, returning JSX
  // You can keep helper functions inside this file.
  return <div>{/* rendered content */}</div>;
};
```

Copy the parsing logic from the current inline implementation, adapting event dispatches (`window.dispatchEvent`) as needed later.

- [ ] **Step 3: Implement knowledge utils and API types**

In `frontend/src/types/api.ts`, define the shared types described in the design (Skill, ChatRequest, ChatEvent, KnowledgeNode, KnowledgeTree). Use the current server JSON shapes as a guide.

In `frontend/src/utils/knowledge.ts`, port `flatten` and `resolvePath` functions from the inline script into TypeScript functions that operate on `KnowledgeTree` and `KnowledgeNode` types.

Commit after Task 8:

```bash
cd /path/to/project-root
git add frontend/src/components/shared/Icon.tsx frontend/src/components/shared/MarkdownRenderer.tsx frontend/src/utils/knowledge.ts frontend/src/types/api.ts
git commit -m "feat: add shared Icon, markdown renderer, and knowledge utilities"
```

---

### Task 9: Implement knowledge pane components and hook

**Files:**
- Create: `frontend/src/hooks/useKnowledge.ts`
- Create: `frontend/src/components/knowledge/KnowledgePane.tsx`
- Create: `frontend/src/components/knowledge/KnowledgeTree.tsx`
- Create: `frontend/src/components/knowledge/FilePreview.tsx`
- Modify: `frontend/src/App.tsx` to render real components

- [ ] **Step 1: Implement useKnowledge hook**

In `frontend/src/hooks/useKnowledge.ts`, create a hook that:

- Fetches `/api/knowledge/tree` from `VITE_API_BASE_URL`.
- Stores `tree`, `expandedPaths`, `selectedPath`, `searchQuery`, `readingPath`, `readInTurn`.
- Exposes functions to toggle folders, select paths, and update search.

Use `fetch` and React’s `useEffect`/`useState`. Type responses with `KnowledgeTree`.

- [ ] **Step 2: Implement KnowledgeTree component**

Port the existing `KnowledgeTree` JSX into `frontend/src/components/knowledge/KnowledgeTree.tsx`, but rely on props rather than `window.KNOWLEDGE`. Use `Icon` and types from `types/api.ts`.

- [ ] **Step 3: Implement FilePreview component**

Port the `FilePreview` logic into `FilePreview.tsx`, using `resolvePath` and types. For now, you can rely on the tree data; if `/api/knowledge/file` exists, you can extend later to lazy-load content.

- [ ] **Step 4: Implement KnowledgePane wrapper**

Create `KnowledgePane.tsx` that ties `useKnowledge`, `KnowledgeTree`, and `FilePreview` together, reproducing the layout and interactions from the current HTML.

- [ ] **Step 5: Wire into App**

Update `frontend/src/App.tsx` to render the left, middle, and right panes using the new `KnowledgePane` and placeholder components for chat and skills.

Commit after Task 9:

```bash
cd /path/to/project-root
git add frontend/src/hooks/useKnowledge.ts frontend/src/components/knowledge
git commit -m "feat: implement knowledge pane with tree and preview"
```

---

### Task 10: Implement chat pane: messages, trace, suggestions, sources, composer

**Files:**
- Create: `frontend/src/hooks/useChat.ts`
- Create: `frontend/src/components/chat/ChatPane.tsx`
- Create: `frontend/src/components/chat/Message.tsx`
- Create: `frontend/src/components/chat/Trace.tsx`
- Create: `frontend/src/components/chat/Suggestions.tsx`
- Create: `frontend/src/components/chat/Sources.tsx`
- Create: `frontend/src/components/chat/Composer.tsx`

- [ ] **Step 1: Implement useChat hook with SSE**

In `frontend/src/hooks/useChat.ts`:

- Maintain `messages` (array of user/assistant messages), `isStreaming`, and optional `currentAssistantIndex`.
- Implement `sendQuestion(question: string)` that:
  - Appends a new user message to `messages`.
  - Opens an `EventSource` connection to `${API_BASE}/api/chat` via a POST-wrapped SSE (or use `fetch` + `ReadableStream` if you decide to adapt). If current backend uses POST+SSE, consider a thin wrapper endpoint or switch to a GET with query params; otherwise, you can keep using `fetch` with `ReadableStream`. Match current backend behaviour as closely as possible.
  - Parses incoming SSE events into `ChatEvent` objects and updates state accordingly.

Because the current backend uses FastAPI `StreamingResponse` with SSE and expects POST JSON, you may need to use `EventSource`-like pattern with a custom polyfill or fall back to `fetch` with streaming `ReadableStream`. For a first pass, you can reuse the existing frontend’s approach: open an `EventSource` if you refactor the backend to accept GET with query; otherwise use streaming fetch. Match event parsing as in the existing inline JS.

- [ ] **Step 2: Implement Message and Trace components**

Port the `Message` and `Trace` components from the HTML file into TypeScript components, using the shared `MarkdownRenderer` and `Icon` components. Ensure trace steps (`think`, `read`, `search`, `skill`) are represented in the `ChatEvent` typing and correctly displayed.

- [ ] **Step 3: Implement Suggestions, Sources, Composer**

Port the JSX and behaviour of `Suggestions`, `Sources`, and `Composer` into their own components. Wire `Suggestions` to call `sendQuestion` with pre-defined questions. Make `Composer` accept `onSend` and `busy` props.

- [ ] **Step 4: Implement ChatPane**

`ChatPane.tsx` should:

- Use `useChat` to get messages, `sendQuestion`, and streaming state.
- Render chat header (title, status pill), message list, and composer.

Commit after Task 10:

```bash
cd /path/to/project-root
git add frontend/src/hooks/useChat.ts frontend/src/components/chat
git commit -m "feat: implement chat pane with streaming SSE support"
```

---

### Task 11: Implement skills panel and config hook

**Files:**
- Create: `frontend/src/hooks/useConfig.ts`
- Create: `frontend/src/hooks/useSkills.ts`
- Create: `frontend/src/components/skills/SkillsPanel.tsx`
- Modify: `frontend/src/App.tsx` to include SkillsPanel and config-aware header

- [ ] **Step 1: Implement useConfig**

Create `useConfig` that fetches `/api/config` once on mount and provides `config`, `loading`, and `error`. Use types from `types/api.ts`.

- [ ] **Step 2: Implement useSkills**

Create `useSkills` that fetches `/api/skills` once and exposes the skills array and a `loading` flag. Optionally expose a way to mark skills as used based on chat trace events.

- [ ] **Step 3: Implement SkillsPanel**

Port `SkillsPanel` JSX into `frontend/src/components/skills/SkillsPanel.tsx`, receiving `skills`, `readingSkill`, and `usedSkillsInTurn` as props (or derive them from `useChat`).

- [ ] **Step 4: Wire everything into App**

Update `App.tsx` so that:

- It uses `useConfig` to display model/provider/user info in the chat header.
- It renders `SkillsPanel` at the bottom of the knowledge/chat column, as per original layout.

Commit after Task 11:

```bash
cd /path/to/project-root
git add frontend/src/hooks/useConfig.ts frontend/src/hooks/useSkills.ts frontend/src/components/skills/SkillsPanel.tsx frontend/src/App.tsx
git commit -m "feat: add skills panel and config-aware layout"
```

---

### Task 12: Basic frontend tests and integration verification

**Files:**
- Create: `frontend/src/App.test.tsx` (or similar)
- Update: `frontend/package.json` test scripts if needed

- [ ] **Step 1: Add a simple smoke test for App**

Using Vitest and React Testing Library, create a minimal test:

```tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders layout shells", () => {
  render(<App />);
  expect(screen.getByText(/Chat pane/i)).toBeInTheDocument();
});
```

Adjust the exact text to match your placeholder content.

- [ ] **Step 2: Configure test script and run**

Ensure `package.json` includes:

```json
"scripts": {
  "test": "vitest"
}
```

Then run:

```bash
cd frontend
npm run test
```

Confirm tests pass.

- [ ] **Step 3: End-to-end manual check**

With backend running on port 8000 and frontend on 5173:

- Load `http://localhost:5173`.
- Confirm knowledge tree loads from `/api/knowledge/tree`.
- Ask a question, observe streaming response and trace.
- Click citations and sources, confirm knowledge preview works.
- Confirm skills panel shows skills and highlights those used.

Commit after Task 12:

```bash
cd /path/to/project-root
git add frontend
git commit -m "test: add basic frontend smoke test and verify integration"
```

---

### Task 13: Clean up old HTML entry and finalize separation

**Files:**
- Modify: `backend/server.py`
- Optionally remove or archive: `Open Virtual Assistant.html`

- [ ] **Step 1: Decide how to serve frontend in production**

For separate deployments (Option A), the backend no longer needs to serve `Open Virtual Assistant.html` at `/`. You can:

- Remove the `/` route that returns `HTML_FILE`, or
- Change it to return a simple JSON message or redirect.

For example, in `backend/server.py`:

```python
from fastapi.responses import JSONResponse


@app.get("/")
async def root() -> JSONResponse:
    return JSONResponse({"message": "Meridian Assistant API. Frontend is served separately."})
```

- [ ] **Step 2: Remove old HTML if no longer needed**

Once the new frontend is confirmed, you can delete `Open Virtual Assistant.html` or move it into an `archive/` directory for historical reference.

```bash
rm Open Virtual Assistant.html
# or
mkdir -p archive
mv Open Virtual Assistant.html archive/
```

- [ ] **Step 3: Update README with new startup instructions**

Document how to run backend and frontend separately:

```markdown
## Development

Backend:

```bash
uv run uvicorn backend.server:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```
```

Commit after Task 13:

```bash
git add backend README.md Open\ Virtual\ Assistant.html
git commit -m "chore: finalize frontend/backend separation and remove legacy HTML entry"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-05-27-frontend-backend-separation-plan.md`.
