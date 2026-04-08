"""Knowledge base retrieval tools for the skilled agent."""

from pathlib import Path

KNOWLEDGE_ROOT = Path("./knowledge")


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
