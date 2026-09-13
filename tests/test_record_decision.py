"""Tests for the record_decision facade/backends (Option A: page-path evidence)."""

from pathlib import Path

from backend.knowledge.knowledge_graph import KnowledgeGraph


def test_kuzu_backend_record_decision_is_noop(tmp_path: Path) -> None:
    # Local backend has no provenance store -> returns None, never raises.
    kg = KnowledgeGraph(tmp_path / "nonexistent")
    assert kg.record_decision("why?", "because", evidence=["a/index.md"]) is None


def test_facade_delegates_to_backend(tmp_path: Path) -> None:
    calls = {}

    class _StubBackend:
        available = True

        def search(self, query, section=None, top_k=5):
            return []

        def record_decision(self, scenario, outcome, reasoning="", evidence=None):
            calls.update(scenario=scenario, outcome=outcome, reasoning=reasoning,
                         evidence=list(evidence or []))
            return {"decision_id": "decision-1", "recorded": True}

    kg = KnowledgeGraph(tmp_path, backend=_StubBackend())
    rec = kg.record_decision("Is an ISA tax-free?", "Yes.", reasoning="cited ISA page",
                             evidence=["investments/isas/index.md"])
    assert rec == {"decision_id": "decision-1", "recorded": True}
    assert calls["scenario"] == "Is an ISA tax-free?"
    assert calls["outcome"] == "Yes."
    assert calls["evidence"] == ["investments/isas/index.md"]


def test_facade_noop_for_backend_without_method(tmp_path: Path) -> None:
    class _OldBackend:
        available = True

        def search(self, query, section=None, top_k=5):
            return []

    kg = KnowledgeGraph(tmp_path, backend=_OldBackend())
    assert kg.record_decision("q", "a") is None


def test_remote_fabric_record_decision_unreachable_returns_none() -> None:
    from backend.knowledge.backends import RemoteFabricBackend

    be = RemoteFabricBackend("http://127.0.0.1:1", token=None)
    # unreachable service -> best-effort no-op, never raises
    assert be.record_decision("q", "a", evidence=["x/index.md"]) is None
