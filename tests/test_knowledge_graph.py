"""Tests for knowledge graph population and search."""

import pytest
from pathlib import Path


@pytest.fixture
def graph_dir(tmp_path: Path) -> Path:
    return tmp_path / "knowledge_graph"


@pytest.fixture
def three_nodes() -> list[dict]:
    return [
        {
            "path": "insurance/home-insurance/index.md",
            "title": "Home Insurance - Aviva",
            "summary": "Covers your home and contents against damage and theft.",
            "topics": ["home insurance", "contents cover"],
            "keywords": ["home", "insurance", "contents", "buildings"],
            "url": "https://www.aviva.co.uk/insurance/home/",
            "section": "insurance",
            "depth": 2,
        },
        {
            "path": "business/defined-benefit-solutions/index.md",
            "title": "Bulk Purchase Annuity - Aviva",
            "summary": "Helps pension schemes de-risk via buy-in or buy-out.",
            "topics": ["defined benefit", "bulk purchase annuity"],
            "keywords": ["pension", "buy-in", "buy-out", "annuity"],
            "url": "https://www.aviva.co.uk/business/db/",
            "section": "business",
            "depth": 2,
        },
        {
            "path": "retirement/personal-pension/index.md",
            "title": "Personal Pension - Aviva",
            "summary": "Save for retirement with a flexible personal pension plan.",
            "topics": ["personal pension", "retirement savings"],
            "keywords": ["pension", "retirement", "savings", "drawdown"],
            "url": "https://www.aviva.co.uk/retirement/personal-pension/",
            "section": "retirement",
            "depth": 2,
        },
    ]


def test_populate_creates_graph_directory(graph_dir: Path, three_nodes: list[dict]) -> None:
    from knowledge_graph import populate
    populate(three_nodes, graph_dir)
    assert graph_dir.exists()


def test_populate_is_idempotent(graph_dir: Path, three_nodes: list[dict]) -> None:
    from knowledge_graph import populate, KnowledgeGraph
    populate(three_nodes, graph_dir)
    populate(three_nodes, graph_dir)  # second run must not raise
    kg = KnowledgeGraph(graph_dir)
    assert kg.available


def test_search_returns_relevant_result(graph_dir: Path, three_nodes: list[dict]) -> None:
    from knowledge_graph import populate, KnowledgeGraph
    populate(three_nodes, graph_dir)
    kg = KnowledgeGraph(graph_dir)
    results = kg.search("home contents insurance")
    assert len(results) >= 1
    assert results[0]["path"] == "insurance/home-insurance/index.md"


def test_search_with_section_scopes_results(graph_dir: Path, three_nodes: list[dict]) -> None:
    from knowledge_graph import populate, KnowledgeGraph
    populate(three_nodes, graph_dir)
    kg = KnowledgeGraph(graph_dir)
    results = kg.search("pension annuity", section="business")
    assert all(r["path"].startswith("business/") for r in results)


def test_search_section_excludes_wrong_section(graph_dir: Path, three_nodes: list[dict]) -> None:
    from knowledge_graph import populate, KnowledgeGraph
    populate(three_nodes, graph_dir)
    kg = KnowledgeGraph(graph_dir)
    # Searching business section for home insurance should return nothing
    results = kg.search("home contents insurance", section="business")
    assert not any(r["path"].startswith("insurance/") for r in results)


def test_search_returns_empty_when_graph_missing(tmp_path: Path) -> None:
    from knowledge_graph import KnowledgeGraph
    kg = KnowledgeGraph(tmp_path / "nonexistent")
    assert kg.search("anything") == []


def test_search_result_has_required_keys(graph_dir: Path, three_nodes: list[dict]) -> None:
    from knowledge_graph import populate, KnowledgeGraph
    populate(three_nodes, graph_dir)
    kg = KnowledgeGraph(graph_dir)
    results = kg.search("insurance")
    assert results
    assert all({"path", "title", "summary"} <= set(r.keys()) for r in results)


def test_search_respects_top_k(graph_dir: Path, three_nodes: list[dict]) -> None:
    from knowledge_graph import populate, KnowledgeGraph
    populate(three_nodes, graph_dir)
    kg = KnowledgeGraph(graph_dir)
    results = kg.search("insurance pension home annuity", top_k=1)
    assert len(results) <= 1
