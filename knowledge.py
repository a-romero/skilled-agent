"""Knowledge base retrieval tools for the skilled agent."""

from pathlib import Path

KNOWLEDGE_ROOT = Path(__file__).parent / "knowledge"


def build_source_registry(readme: Path) -> dict[str, dict]:
    """Parse knowledge/README.md table into {relative_path: {url, title}}."""
    registry: dict[str, dict] = {}
    for line in readme.read_text().splitlines():
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
    if not str(target).startswith(str(resolved_root)):
        return f"Error: path '{rel_path}' is outside the knowledge root"
    if not target.exists():
        return f"Error: '{rel_path}' not found in knowledge base"
    content = target.read_text()
    if rel_path.endswith("index.md") and rel_path in source_registry:
        source = source_registry[rel_path]
        content = f"[Source: {source['title']} — {source['url']}]\n\n{content}"
    return content
