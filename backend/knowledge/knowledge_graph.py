"""Knowledge graph backed by Kuzu with BM25 search over enriched knowledge pages."""

import shutil
from pathlib import Path

import kuzu
from rank_bm25 import BM25Okapi

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


class KnowledgeGraph:
    """Runtime interface: loads all Page nodes into memory and provides BM25 search."""

    def __init__(self, graph_dir: Path = GRAPH_ROOT) -> None:
        self._docs: list[dict] = []
        self._bm25: BM25Okapi | None = None
        if not graph_dir.exists():
            return
        db = kuzu.Database(str(graph_dir))
        conn = kuzu.Connection(db)
        self._load(conn)

    def _load(self, conn: kuzu.Connection) -> None:
        result = conn.execute(
            "MATCH (p:Page) "
            "RETURN p.path, p.title, p.summary, p.topics, p.keywords, p.section"
        )
        rows: list[dict] = []
        while result.has_next():
            r = result.get_next()
            rows.append({
                "path": r[0],
                "title": r[1] or "",
                "summary": r[2] or "",
                "topics": r[3] or [],
                "keywords": r[4] or [],
                "section": r[5] or "",
            })
        self._docs = rows
        if rows:
            corpus = [self._text(d).split() for d in rows]
            self._bm25 = BM25Okapi(corpus)

    def _text(self, doc: dict) -> str:
        topics = " ".join(doc["topics"])
        keywords = " ".join(doc["keywords"])
        return f"{doc['title']} {doc['summary']} {topics} {keywords}".lower()

    @property
    def available(self) -> bool:
        """True if the graph was loaded and contains nodes."""
        return bool(self._docs)

    def search(
        self,
        query: str,
        section: str | None = None,
        top_k: int = 5,
    ) -> list[dict]:
        """Return up to top_k pages ranked by BM25 relevance.

        Each result is a dict with keys: path, title, summary.
        Returns [] if the graph is unavailable or no results score above zero.
        """
        if not self.available:
            return []

        candidates = (
            [d for d in self._docs if d["section"] == section]
            if section
            else self._docs
        )
        if not candidates:
            return []

        if section:
            bm25: BM25Okapi = BM25Okapi([self._text(c).split() for c in candidates])
        else:
            bm25 = self._bm25
        if bm25 is None:
            return []

        scores = bm25.get_scores(query.lower().split())
        ranked = sorted(zip(scores, candidates), key=lambda x: x[0], reverse=True)
        return [
            {"path": d["path"], "title": d["title"], "summary": d["summary"]}
            for score, d in ranked[:top_k]
            if score > 0
        ]
