"""Tests for the RemoteFabricBackend and RETRIEVAL_BACKEND selection.

These don't require the semantic-fabric service or fabric-client to be installed:
they exercise the graceful-fallback paths and backend injection. When fabric-client
and a live service are present, the integration is covered by the fabric repo's own
contract tests.
"""

from pathlib import Path

from backend.knowledge.backends import RemoteFabricBackend
from backend.knowledge.knowledge_graph import KnowledgeGraph


def test_remote_fabric_unreachable_is_not_available() -> None:
    # Nothing listening here / or fabric-client absent -> available is False, never raises.
    be = RemoteFabricBackend("http://127.0.0.1:1", token=None)
    assert be.available is False
    assert be.search("anything") == []


def test_knowledge_graph_falls_back_to_kuzu(monkeypatch, tmp_path: Path) -> None:
    # Ask for the fabric backend but point it at a dead address; KnowledgeGraph must
    # fall back to Kuzu (which, with no graph dir, is simply unavailable — not an error).
    monkeypatch.setenv("RETRIEVAL_BACKEND", "fabric")
    monkeypatch.setenv("FABRIC_URL", "http://127.0.0.1:1")
    kg = KnowledgeGraph(tmp_path / "nonexistent")
    assert kg.available is False
    assert kg.search("anything") == []


def test_backend_injection_bypasses_env(tmp_path: Path) -> None:
    class _StubBackend:
        available = True

        def search(self, query, section=None, top_k=5):
            return [{"path": "x/index.md", "title": "X", "summary": query}]

    kg = KnowledgeGraph(tmp_path, backend=_StubBackend())
    assert kg.available is True
    assert kg.search("hello")[0]["summary"] == "hello"


def test_default_backend_is_kuzu(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.delenv("RETRIEVAL_BACKEND", raising=False)
    kg = KnowledgeGraph(tmp_path / "nonexistent")
    # No graph present -> unavailable, but the default path is Kuzu and does not raise.
    assert kg.available is False


def test_graph_expand_empty_on_kuzu_backend(tmp_path: Path) -> None:
    # Local Kuzu backend has no traversal wired -> graph_expand returns [].
    kg = KnowledgeGraph(tmp_path / "nonexistent")
    assert kg.graph_expand("investments/isas/index.md") == []


def test_graph_expand_fallback_for_backend_without_method(tmp_path: Path) -> None:
    class _StubBackend:
        available = True

        def search(self, query, section=None, top_k=5):
            return []

    # A backend that predates graph_expand must not break the facade.
    kg = KnowledgeGraph(tmp_path, backend=_StubBackend())
    assert kg.graph_expand("anything") == []


def test_remote_fabric_graph_expand_unreachable() -> None:
    be = RemoteFabricBackend("http://127.0.0.1:1", token=None)
    assert be.graph_expand("investments/isas/index.md") == []
