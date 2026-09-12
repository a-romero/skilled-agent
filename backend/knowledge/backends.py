"""Retrieval backends behind the KnowledgeGraph facade.

Two implementations sit behind one small protocol so the rest of skilled-agent is
unaware of which is active:

- ``KuzuBM25Backend`` — the original local Kuzu + BM25 retrieval. Default; runs
  standalone with no external service.
- ``RemoteFabricBackend`` — calls the semantic-fabric service over HTTP via the
  thin ``fabric-client`` package. skilled-agent stays semantica-free; it only
  imports ``fabric_client``. If the service (or the client package) is unavailable,
  the backend reports ``available == False`` so the caller can fall back to Kuzu —
  the agent never hard-fails on a missing layer.

Selection is by environment variable (see ``knowledge_graph.KnowledgeGraph``):

    RETRIEVAL_BACKEND = kuzu | fabric      # default kuzu
    FABRIC_URL        = http://semantic-fabric:8080
    FABRIC_TOKEN      = <service token>
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Protocol, runtime_checkable

logger = logging.getLogger(__name__)


@runtime_checkable
class RetrievalBackend(Protocol):
    """The contract every backend satisfies. Matches KnowledgeGraph's public shape."""

    @property
    def available(self) -> bool: ...

    def search(self, query: str, section: str | None = None, top_k: int = 5) -> list[dict]:
        """Return up to top_k results, each a dict with keys path, title, summary."""
        ...


class KuzuBM25Backend:
    """Local Kuzu-backed graph with BM25 search over enriched pages.

    This is the original KnowledgeGraph retrieval logic, unchanged in behaviour and
    moved here so it can sit behind the backend protocol.
    """

    def __init__(self, graph_dir: Path) -> None:
        self._docs: list[dict] = []
        self._bm25 = None
        if not graph_dir.exists():
            return
        import kuzu

        db = kuzu.Database(str(graph_dir))
        conn = kuzu.Connection(db)
        self._load(conn)

    def _load(self, conn) -> None:  # noqa: ANN001 - kuzu.Connection
        from rank_bm25 import BM25Okapi

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
        return bool(self._docs)

    def search(self, query: str, section: str | None = None, top_k: int = 5) -> list[dict]:
        from rank_bm25 import BM25Okapi

        if not self.available:
            return []

        candidates = (
            [d for d in self._docs if d["section"] == section] if section else self._docs
        )
        if not candidates:
            return []

        if section:
            bm25 = BM25Okapi([self._text(c).split() for c in candidates])
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


class RemoteFabricBackend:
    """Retrieval via the semantic-fabric service (HTTP), through fabric-client.

    Keeps skilled-agent semantica-free: the only new dependency is ``fabric-client``.
    ``search()`` returns the same {path, title, summary} dicts as the Kuzu backend by
    projecting each evidence unit through ``to_legacy()``.
    """

    def __init__(self, base_url: str, token: str | None = None) -> None:
        self._available = False
        self._client = None
        try:
            from fabric_client import FabricClient  # optional dependency
        except ImportError:
            logger.warning(
                "RETRIEVAL_BACKEND=fabric but 'fabric-client' is not installed; "
                "falling back. Install it from the semantic-fabric repo (client/)."
            )
            return
        try:
            self._client = FabricClient(base_url, token=token)
            self._client.health()  # probe once at construction
            self._available = True
        except Exception as exc:  # network down, bad URL, etc.
            logger.warning("semantic-fabric unreachable at %s (%s); falling back.", base_url, exc)
            self._client = None

    @property
    def available(self) -> bool:
        return self._available

    def search(self, query: str, section: str | None = None, top_k: int = 5) -> list[dict]:
        if not self._available or self._client is None:
            return []
        try:
            units = self._client.search(query, section=section, top_k=top_k)
            return [u.to_legacy() for u in units]
        except Exception as exc:
            logger.warning("fabric search failed (%s); returning no results.", exc)
            return []
