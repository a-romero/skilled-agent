"""Knowledge graph population plus a pluggable retrieval facade.

``populate()`` still builds the local Kuzu graph from enriched pages (used by the
enrichment pipeline). ``KnowledgeGraph`` is now a thin facade that delegates search
to a backend selected at runtime — the local Kuzu/BM25 backend by default, or the
remote semantic-fabric service when ``RETRIEVAL_BACKEND=fabric``. Its public shape
(``available`` and ``search(query, section, top_k) -> list[dict]``) is unchanged, so
existing callers and tests are unaffected.
"""

import logging
import os
import shutil
from pathlib import Path

import kuzu

from backend.knowledge.backends import (
    KuzuBM25Backend,
    RemoteFabricBackend,
    RetrievalBackend,
)

logger = logging.getLogger(__name__)

GRAPH_ROOT = Path(__file__).parent.parent.parent / "knowledge_graph"


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


def _select_backend(graph_dir: Path) -> RetrievalBackend:
    """Choose a retrieval backend from RETRIEVAL_BACKEND (default 'kuzu').

    'fabric' uses the remote semantic-fabric service; if it is unreachable (or
    fabric-client is not installed), we fall back to the local Kuzu backend so the
    agent keeps working standalone.
    """
    choice = os.getenv("RETRIEVAL_BACKEND", "kuzu").strip().lower()
    if choice == "fabric":
        remote = RemoteFabricBackend(
            base_url=os.getenv("FABRIC_URL", "http://localhost:8080"),
            token=os.getenv("FABRIC_TOKEN") or None,
        )
        if remote.available:
            logger.info("Retrieval backend: semantic-fabric")
            return remote
        logger.warning("semantic-fabric unavailable; falling back to Kuzu/BM25.")
    return KuzuBM25Backend(graph_dir)


class KnowledgeGraph:
    """Retrieval facade. Delegates to a Kuzu/BM25 or remote-fabric backend.

    Public shape is unchanged: ``available`` and ``search(query, section, top_k)``
    returning ``list[dict]`` with keys path, title, summary.
    """

    def __init__(self, graph_dir: Path = GRAPH_ROOT, backend: RetrievalBackend | None = None) -> None:
        self._backend: RetrievalBackend = backend if backend is not None else _select_backend(graph_dir)

    @property
    def available(self) -> bool:
        """True if the active backend has data / a reachable service."""
        return self._backend.available

    def search(self, query: str, section: str | None = None, top_k: int = 5) -> list[dict]:
        """Return up to top_k results (path, title, summary) from the active backend.

        Returns [] if the backend is unavailable or nothing matches.
        """
        return self._backend.search(query, section=section, top_k=top_k)
