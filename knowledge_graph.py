"""Knowledge graph backed by Kuzu with BM25 search over enriched knowledge pages."""

import shutil
from pathlib import Path

import kuzu

GRAPH_ROOT = Path(__file__).parent / "knowledge_graph"


def _create_schema(conn: kuzu.Connection) -> None:
    """Create node and relationship tables."""
    conn.execute(
        "CREATE NODE TABLE Page("
        "path STRING, title STRING, summary STRING, "
        "topics STRING[], keywords STRING[], url STRING, "
        "section STRING, depth INT64, PRIMARY KEY (path)"
        ")"
    )
    conn.execute("CREATE REL TABLE CHILD_OF(FROM Page TO Page)")


def populate(nodes: list[dict], graph_dir: Path = GRAPH_ROOT) -> None:
    """(Re)build the graph from node dicts. Idempotent: drops and rebuilds each run.

    Each node dict must have keys: path, title, summary, topics, keywords, url, section, depth.
    CHILD_OF edges are derived from path structure: each node links to its nearest
    ancestor that also has an index.md in the node set.
    """
    if graph_dir.exists():
        if graph_dir.is_dir():
            shutil.rmtree(graph_dir)
        else:
            graph_dir.unlink()

    db = kuzu.Database(str(graph_dir))
    conn = kuzu.Connection(db)
    _create_schema(conn)

    paths_inserted = {n["path"] for n in nodes}

    for node in nodes:
        conn.execute(
            "CREATE (p:Page {path: $path, title: $title, summary: $summary, "
            "topics: $topics, keywords: $keywords, url: $url, "
            "section: $section, depth: $depth})",
            {
                "path": node["path"],
                "title": node["title"],
                "summary": node["summary"],
                "topics": node["topics"],
                "keywords": node["keywords"],
                "url": node["url"],
                "section": node["section"],
                "depth": node["depth"],
            },
        )

    for node in nodes:
        rel = Path(node["path"])
        # Walk up from the parent directory to find nearest ancestor index.md
        parent = rel.parent.parent  # e.g. business/workplace-pensions for .../index.md
        while str(parent) != ".":
            ancestor_path = str(parent / "index.md")
            if ancestor_path in paths_inserted:
                conn.execute(
                    "MATCH (child:Page {path: $child}), (par:Page {path: $par}) "
                    "CREATE (child)-[:CHILD_OF]->(par)",
                    {"child": node["path"], "par": ancestor_path},
                )
                break
            parent = parent.parent
