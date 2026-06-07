"""Knowledge base retrieval tools for the skilled agent."""

import json
import logging
from pathlib import Path
from typing import Any

from backend.knowledge.knowledge_graph import KnowledgeGraph
from backend.utils.file_io import safe_read_text
from backend.utils.path_security import validate_safe_path
from backend.utils.yaml_parser import parse_index_md

logger = logging.getLogger(__name__)

KNOWLEDGE_ROOT = (Path(__file__).parent / ".." / ".." / "knowledge").resolve()


def read_knowledge_file(rel_path: str, knowledge_root: Path | None = None) -> dict[str, Any]:
    """Read a knowledge file and return structured data with path, frontmatter, and body.
    
    Args:
        rel_path: Knowledge-relative path, e.g. 'business/group-life/index.md'
        knowledge_root: Optional override for knowledge root path
    
    Returns:
        Dict with 'path', 'frontmatter', and 'body' keys
    
    Raises:
        FileNotFoundError: If the file doesn't exist or path is invalid
        IOError: If the file cannot be read
    """
    if knowledge_root is None:
        knowledge_root = KNOWLEDGE_ROOT
    
    resolved_root = knowledge_root.resolve()
    target = (knowledge_root / rel_path).resolve()
    
    # Security check using utility
    try:
        validate_safe_path(target, resolved_root)
    except ValueError:
        raise FileNotFoundError(f"Path '{rel_path}' is outside the knowledge root")
    
    if not target.exists():
        raise FileNotFoundError(f"File '{rel_path}' not found in knowledge base")
    
    if not target.is_file():
        raise FileNotFoundError(f"Path '{rel_path}' is not a file")
    
    parsed = parse_index_md(target)
    
    return {
        "path": rel_path,
        "frontmatter": parsed["frontmatter"],
        "body": parsed["body"],
    }


def build_source_registry(readme: Path) -> dict[str, dict]:
    """Parse knowledge/README.md table into {relative_path: {url, title}}."""
    registry: dict[str, dict] = {}
    try:
        content = safe_read_text(readme)
    except Exception as e:
        logger.error(f"Failed to read README.md: {e}")
        return registry
    
    for line in content.splitlines():
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
    """Read a knowledge file; prepend source header for index.md content pages.
    
    Raises:
        FileNotFoundError: If file doesn't exist or path is invalid
    """
    rel_path = inp.get("path", "").strip()
    resolved_root = knowledge_root.resolve()
    target = (knowledge_root / rel_path).resolve()
    
    # Use validate_safe_path for consistent security checking
    try:
        validate_safe_path(target, resolved_root)
    except ValueError:
        raise FileNotFoundError(f"Path '{rel_path}' is outside the knowledge root")
    
    if not target.exists():
        raise FileNotFoundError(f"'{rel_path}' not found in knowledge base")
    
    if not target.is_file():
        raise FileNotFoundError(f"'{rel_path}' is not a readable file")
    
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
        try:
            return read_knowledge(inp, source_registry, knowledge_root)
        except FileNotFoundError as e:
            return f"Error: {e}"
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
