"""Knowledge base retrieval tools for the skilled agent."""

import json
from pathlib import Path
from typing import Any

import yaml

from backend.knowledge.knowledge_graph import KnowledgeGraph

KNOWLEDGE_ROOT = Path(__file__).parent / "knowledge"


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


def read_knowledge_file(rel_path: str, knowledge_root: Path | None = None) -> dict[str, Any]:
    """Read a knowledge file and return structured data with path, frontmatter, and body.
    
    Args:
        rel_path: Knowledge-relative path, e.g. 'business/group-life/index.md'
        knowledge_root: Optional override for knowledge root path
    
    Returns:
        Dict with 'path', 'frontmatter', and 'body' keys
    
    Raises:
        FileNotFoundError: If the file doesn't exist or path is invalid
    """
    if knowledge_root is None:
        # Default to project root knowledge directory
        knowledge_root = (Path(__file__).parent / ".." / ".." / "knowledge").resolve()
    
    resolved_root = knowledge_root.resolve()
    target = (knowledge_root / rel_path).resolve()
    
    # Security check: ensure path is within knowledge root
    if resolved_root not in target.parents and target != resolved_root:
        raise FileNotFoundError(f"Path '{rel_path}' is outside the knowledge root")
    
    if not target.exists():
        raise FileNotFoundError(f"File '{rel_path}' not found in knowledge base")
    
    if not target.is_file():
        raise FileNotFoundError(f"Path '{rel_path}' is not a file")
    
    parsed = _parse_index_md(target)
    
    return {
        "path": rel_path,
        "frontmatter": parsed["frontmatter"],
        "body": parsed["body"],
    }


def build_source_registry(readme: Path) -> dict[str, dict]:
    """Parse knowledge/README.md table into {relative_path: {url, title}}."""
    registry: dict[str, dict] = {}
    for line in readme.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 3:
            continue
        url, title, file_cell = cells[0], cells[1], cells[2]
        # Skip header and separator rows
        if url == "URL" or not url or set(url) <= {"-", " "}:
            continue
        file_path = file_cell.strip("`").strip()
        if file_path.startswith("aviva/"):
            file_path = file_path[len("aviva/"):]
        if url and title and file_path:
            registry[file_path] = {"url": url, "title": title}
    return registry


def read_knowledge(
    inp: dict,
    source_registry: dict,
    knowledge_root: Path = KNOWLEDGE_ROOT,
) -> str:
    """Read a knowledge file; prepend source header for index.md content pages."""
    rel_path = inp.get("path", "").strip()
    resolved_root = knowledge_root.resolve()
    target = (knowledge_root / rel_path).resolve()
    if resolved_root not in target.parents and target != resolved_root:
        return f"Error: path '{rel_path}' is outside the knowledge root"
    if not target.exists():
        return f"Error: '{rel_path}' not found in knowledge base"
    if not target.is_file():
        return f"Error: '{rel_path}' is not a readable file"
    content = target.read_text(encoding="utf-8")
    if rel_path.endswith("index.md") and rel_path in source_registry:
        source = source_registry[rel_path]
        content = f"[Source: {source['title']} — {source['url']}]\n\n{content}"
    return content


def handle_knowledge_tool(
    name: str,
    inp: dict,
    source_registry: dict,
    knowledge_root: Path = KNOWLEDGE_ROOT,
    knowledge_graph: KnowledgeGraph | None = None,
) -> str:
    """Dispatch knowledge tool calls."""
    if name == "read_knowledge":
        return read_knowledge(inp, source_registry, knowledge_root)
    if name == "search_knowledge_graph":
        if knowledge_graph is None or not knowledge_graph.available:
            return json.dumps([])
        results = knowledge_graph.search(
            inp.get("query", ""),
            section=inp.get("section"),
        )
        return json.dumps(results, indent=2)
    return f"Error: unknown knowledge tool '{name}'"


_SEARCH_TOOL: dict = {
    "name": "search_knowledge_graph",
    "description": (
        "Search the knowledge graph for pages relevant to a query. "
        "Returns the top 5 most relevant pages with path, title, and summary. "
        "Use this as your primary navigation method instead of reading SUMMARY.MD files. "
        "Provide a section when the topic domain is clear to scope the search."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Natural language query describing what you are looking for",
            },
            "section": {
                "type": "string",
                "description": "Scope search to a top-level section. Omit to search globally.",
                "enum": [
                    "business",
                    "health",
                    "health-insurance",
                    "health-providers",
                    "help-and-support",
                    "insurance",
                    "investments",
                    "retirement",
                    "risksolutions",
                    "services",
                ],
            },
        },
        "required": ["query"],
    },
}

KNOWLEDGE_TOOLS: list[dict] = [
    {
        "name": "read_knowledge",
        "description": (
            "Read a file from the knowledge base. "
            "Navigate using SUMMARY.MD files at each directory level "
            "(e.g. 'business/SUMMARY.MD'). "
            "Read a page's index.md for full content once identified."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": (
                        "Relative path from knowledge root. "
                        "Examples: 'business/SUMMARY.MD', "
                        "'business/group-protection/group-life-insurance/index.md'"
                    ),
                }
            },
            "required": ["path"],
        },
    },
    _SEARCH_TOOL,
]
