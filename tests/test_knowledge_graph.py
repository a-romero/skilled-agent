"""Tests for knowledge graph population and search."""

import pytest
from pathlib import Path


@pytest.fixture
def graph_dir(tmp_path: Path) -> Path:
    return tmp_path / "knowledge_graph"


@pytest.fixture
def two_nodes() -> list[dict]:
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
    ]


def test_populate_creates_graph_directory(graph_dir: Path, two_nodes: list[dict]) -> None:
    from knowledge_graph import populate
    populate(two_nodes, graph_dir)
    assert graph_dir.exists()


def test_populate_is_idempotent(graph_dir: Path, two_nodes: list[dict]) -> None:
    from knowledge_graph import populate
    populate(two_nodes, graph_dir)
    populate(two_nodes, graph_dir)  # second run must not raise
    assert graph_dir.exists()
