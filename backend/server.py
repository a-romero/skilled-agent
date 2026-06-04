"""
Meridian Assistant — FastAPI server
=====================================
Serves the frontend and provides two API endpoints:

  GET  /api/knowledge/tree   — real knowledge directory as JSON tree
  GET  /api/skills           — available skill names and descriptions
  POST /api/chat             — SSE stream: runs dspy_agent and emits events

Run with:
    uv run uvicorn backend.server:app --reload --port 8000
"""

import asyncio
import json
import logging
import os
import queue
import re
import threading
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from backend.knowledge.knowledge import read_knowledge_file
from backend.skills.skills import build_skill_registry

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

_HERE = Path(__file__).parent
KNOWLEDGE_ROOT = (_HERE / ".." / "knowledge").resolve()
# HTML_FILE moved to archive/ - frontend now runs separately on Vite


def _get_cors_origins() -> list[str]:
    """Get CORS allowed origins from environment or return sensible defaults."""
    raw = os.getenv("CORS_ORIGINS")
    if not raw:
        # Default for local dev: frontend on 5173/5174 (Vite), backend on 8000
        return [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:8000",
        ]
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(title="Meridian Assistant")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=(_HERE / ".." / "static").resolve()), name="static")


# ---------------------------------------------------------------------------
# Knowledge tree builder
# ---------------------------------------------------------------------------

def _parse_summary_md(path: Path) -> str:
    """Return the one-paragraph description from a SUMMARY.MD file."""
    try:
        text = path.read_text(encoding="utf-8")
        # First non-heading, non-empty paragraph after the title
        lines = text.splitlines()
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                return stripped
    except Exception:
        pass
    return ""


def _parse_index_md(path: Path) -> dict[str, Any]:
    """Return { frontmatter: dict, body: str } from an index.md file."""
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return {"frontmatter": {}, "body": ""}

    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            fm_raw = text[3:end]
            body = text[end + 3:].strip()
            try:
                fm = yaml.safe_load(fm_raw) or {}
            except Exception:
                fm = {}
            return {"frontmatter": fm, "body": body}
    return {"frontmatter": {}, "body": text}


def _build_tree(directory: Path, rel_prefix: str = "") -> list[dict]:
    """Recursively build a list of dir/file nodes for *directory*."""
    nodes: list[dict] = []

    # index.md in this directory — comes first as a direct file child
    index_path = directory / "index.md"
    if index_path.exists():
        parsed = _parse_index_md(index_path)
        fm = parsed["frontmatter"]
        nodes.append({
            "type": "file",
            "name": "index.md",
            "frontmatter": {
                "url":      fm.get("url", ""),
                "title":    fm.get("title", index_path.parent.name),
                "summary":  fm.get("summary", ""),
                "topics":   fm.get("topics") or [],
                "keywords": fm.get("keywords") or [],
            },
            "body": parsed["body"],
        })

    # Sub-directories
    for child in sorted(directory.iterdir()):
        if not child.is_dir():
            continue
        summary_path = child / "SUMMARY.MD"
        summary = _parse_summary_md(summary_path) if summary_path.exists() else ""
        children = _build_tree(child, rel_prefix + child.name + "/")
        if children or summary:
            nodes.append({
                "type":     "dir",
                "name":     child.name,
                "summary":  summary,
                "children": children,
            })

    return nodes


def build_knowledge_tree() -> dict:
    """Return the full knowledge tree as a dict compatible with the frontend."""
    root_summary_path = KNOWLEDGE_ROOT / "SUMMARY.MD"
    root_summary = _parse_summary_md(root_summary_path) if root_summary_path.exists() else ""
    return {
        "brand": "Aviva",
        "root": {
            "path":     "",
            "name":     "knowledge",
            "summary":  root_summary,
            "children": _build_tree(KNOWLEDGE_ROOT),
        },
    }


# ---------------------------------------------------------------------------
# Source path extraction from agent answer
# ---------------------------------------------------------------------------

def _extract_sources(answer: str) -> tuple[str, list[str]]:
    """Split answer into (body_without_sources, [source_urls]).

    The agent is instructed to end with:
        ## Sources
        - [Title](https://url)
    """
    sources_pattern = re.compile(r"\n?##\s+Sources\s*\n(.*)", re.DOTALL | re.IGNORECASE)
    m = sources_pattern.search(answer)
    if not m:
        return answer, []

    body = answer[: m.start()].strip()
    sources_block = m.group(1)
    urls: list[str] = re.findall(r"\(https?://[^\)]+\)", sources_block)
    urls = [u.strip("()") for u in urls]
    return body, urls


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.get("/")
async def root() -> dict[str, str]:
    """Backend API root - frontend runs separately on Vite (default: http://localhost:5173)."""
    return {
        "service": "Meridian Assistant API",
        "frontend": "http://localhost:5173",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/config")
async def config() -> dict:
    """Return runtime configuration for the frontend."""
    import os
    return {
        "model": os.getenv("LLM_MODEL", ""),
        "provider": os.getenv("LLM_PROVIDER", ""),
        "user": os.getenv("OVA_USER", "Anonymous"),
        "org": os.getenv("OVA_ORG", "Anonymous"),
    }


@app.get("/api/health")
async def health() -> dict:
    """Simple healthcheck endpoint for frontend and monitoring."""
    return {"status": "ok"}


@app.get("/api/knowledge/tree")
async def knowledge_tree() -> dict:
    """Return the real knowledge directory as a JSON tree."""
    return build_knowledge_tree()


@app.get("/api/knowledge/file")
async def knowledge_file(
    path: str = Query(..., description="Knowledge-relative path, e.g. 'business/group-life/index.md'")
) -> dict:
    """Return a specific knowledge file's parsed contents with frontmatter and body."""
    try:
        return read_knowledge_file(path, knowledge_root=KNOWLEDGE_ROOT)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/skills")
async def skills_list() -> list[dict]:
    """Return all available skills with their one-line descriptions."""
    registry = build_skill_registry((_HERE / ".." / "skills").resolve())
    return [
        {"name": name, "description": meta["description"]}
        for name, meta in registry.items()
    ]


@app.post("/api/chat")
async def chat(request: Request) -> StreamingResponse:
    """Run dspy_agent and stream events to the frontend as SSE."""
    body = await request.json()
    question: str = body.get("question", "").strip()
    history: list[dict] = body.get("history", [])[-6:]
    config: dict = body.get("config", {})
    selected_skills: list[str] | None = config.get("skills")
    if not question:
        async def _empty():
            yield 'data: {"kind":"error","text":"No question provided."}\n\n'
        return StreamingResponse(_empty(), media_type="text/event-stream")

    event_q: queue.Queue[dict | None] = queue.Queue()

    def _run() -> None:
        """Run the agent in a background thread, pushing events into the queue."""
        import backend.dspy_agent as dspy_agent  # local import so .env is already loaded

        read_index_paths: list[str] = []

        def on_event(evt: dict) -> None:
            # Track index.md reads to build the sources list
            if evt.get("kind") == "read" and evt.get("path", "").endswith("index.md"):
                read_index_paths.append(evt["path"])
            event_q.put(evt)

        try:
            answer = dspy_agent.run_agent(
                task=question,
                verbose=False,
                event_callback=on_event,
                history=history,
                selected_skills=selected_skills,
            )
            # Strip the "## Sources" section from the answer body
            body_text, _ = _extract_sources(answer)
            # Stream the answer text in small chunks
            event_q.put({"kind": "say_start"})
            words = body_text.split(" ")
            chunk = ""
            for i, word in enumerate(words):
                chunk += ("" if i == 0 else " ") + word
                if len(chunk) >= 6:
                    event_q.put({"kind": "say_chunk", "text": chunk})
                    chunk = ""
            if chunk:
                event_q.put({"kind": "say_chunk", "text": chunk})
            event_q.put({"kind": "say_end"})
            # Emit sources as knowledge-relative paths so the frontend can
            # resolve titles / URLs via the loaded knowledge tree
            if read_index_paths:
                event_q.put({"kind": "sources", "paths": read_index_paths})
        except Exception as exc:
            event_q.put({"kind": "error", "text": str(exc)})
        finally:
            event_q.put(None)  # sentinel

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    async def _stream():
        while True:
            try:
                evt = event_q.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.02)
                continue
            if evt is None:
                break
            yield f"data: {json.dumps(evt)}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
