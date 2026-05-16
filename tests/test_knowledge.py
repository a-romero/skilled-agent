import textwrap
import pytest
from pathlib import Path
from knowledge import (
    build_source_registry,
    read_knowledge,
    handle_knowledge_tool,
    KNOWLEDGE_TOOLS,
)

README_MD = textwrap.dedent("""\
    # Aviva Website Crawl

    | URL | Title | File |
    |-----|-------|------|
    | https://www.aviva.co.uk/business/ | Business - Aviva | `aviva/business/index.md` |
    | https://www.aviva.co.uk/retirement/ | Retirement - Aviva | `aviva/retirement/index.md` |
""")


@pytest.fixture
def readme(tmp_path: Path) -> Path:
    p = tmp_path / "README.md"
    p.write_text(README_MD)
    return p


@pytest.fixture
def source_registry(readme: Path) -> dict[str, dict]:
    return build_source_registry(readme)


def test_build_source_registry_parses_url(source_registry: dict) -> None:
    assert source_registry["business/index.md"]["url"] == "https://www.aviva.co.uk/business/"


def test_build_source_registry_parses_title(source_registry: dict) -> None:
    assert source_registry["business/index.md"]["title"] == "Business - Aviva"


def test_build_source_registry_strips_aviva_prefix(source_registry: dict) -> None:
    assert "retirement/index.md" in source_registry
    assert "aviva/retirement/index.md" not in source_registry


def test_build_source_registry_skips_header_row(source_registry: dict) -> None:
    assert "URL" not in source_registry


def test_build_source_registry_returns_empty_for_no_data_rows(tmp_path: Path) -> None:
    readme = tmp_path / "README.md"
    readme.write_text("| URL | Title | File |\n|-----|-------|------|\n")
    assert build_source_registry(readme) == {}


@pytest.fixture
def knowledge_root(tmp_path: Path) -> Path:
    root = tmp_path / "knowledge"
    root.mkdir()
    biz = root / "business"
    biz.mkdir()
    (biz / "index.md").write_text(
        '---\nurl: https://www.aviva.co.uk/business/\ntitle: "Business - Aviva"\n---\n\nPage content.'
    )
    (root / "SUMMARY.MD").write_text("# Knowledge Base\n\nRoot summary.\n")
    return root


@pytest.fixture
def registry_for_root() -> dict:
    return {
        "business/index.md": {
            "url": "https://www.aviva.co.uk/business/",
            "title": "Business - Aviva",
        }
    }


def test_read_knowledge_returns_content(
    knowledge_root: Path, registry_for_root: dict
) -> None:
    result = read_knowledge(
        {"path": "business/index.md"}, registry_for_root, knowledge_root
    )
    assert "Page content." in result


def test_read_knowledge_prepends_source_header(
    knowledge_root: Path, registry_for_root: dict
) -> None:
    result = read_knowledge(
        {"path": "business/index.md"}, registry_for_root, knowledge_root
    )
    assert "[Source: Business - Aviva — https://www.aviva.co.uk/business/]" in result


def test_read_knowledge_no_header_for_summary_md(
    knowledge_root: Path, registry_for_root: dict
) -> None:
    result = read_knowledge({"path": "SUMMARY.MD"}, registry_for_root, knowledge_root)
    assert "[Source:" not in result


def test_read_knowledge_error_on_missing_file(
    knowledge_root: Path, registry_for_root: dict
) -> None:
    result = read_knowledge(
        {"path": "nonexistent/index.md"}, registry_for_root, knowledge_root
    )
    assert result.startswith("Error:")


def test_read_knowledge_prevents_traversal(
    knowledge_root: Path, registry_for_root: dict
) -> None:
    result = read_knowledge(
        {"path": "../../etc/passwd"}, registry_for_root, knowledge_root
    )
    assert result.startswith("Error:")


def test_read_knowledge_error_on_directory_path(
    knowledge_root: Path, registry_for_root: dict
) -> None:
    result = read_knowledge({"path": ""}, registry_for_root, knowledge_root)
    assert result.startswith("Error:")


def test_handle_knowledge_tool_dispatches(
    knowledge_root: Path, registry_for_root: dict
) -> None:
    result = handle_knowledge_tool(
        "read_knowledge",
        {"path": "business/index.md"},
        registry_for_root,
        knowledge_root,
    )
    assert "Page content." in result


def test_handle_knowledge_tool_unknown_returns_error(
    knowledge_root: Path, registry_for_root: dict
) -> None:
    result = handle_knowledge_tool("no_such_tool", {}, registry_for_root, knowledge_root)
    assert result.startswith("Error:")


def test_knowledge_tools_has_read_knowledge() -> None:
    names = [t["name"] for t in KNOWLEDGE_TOOLS]
    assert "read_knowledge" in names


def test_knowledge_tools_schema_has_path_param() -> None:
    tool = next(t for t in KNOWLEDGE_TOOLS if t["name"] == "read_knowledge")
    assert "path" in tool["input_schema"]["properties"]
    assert "path" in tool["input_schema"]["required"]


def test_knowledge_tools_has_search_knowledge_graph() -> None:
    from knowledge import KNOWLEDGE_TOOLS
    names = [t["name"] for t in KNOWLEDGE_TOOLS]
    assert "search_knowledge_graph" in names


def test_search_knowledge_graph_tool_has_query_param() -> None:
    from knowledge import KNOWLEDGE_TOOLS
    tool = next(t for t in KNOWLEDGE_TOOLS if t["name"] == "search_knowledge_graph")
    assert "query" in tool["input_schema"]["properties"]
    assert "query" in tool["input_schema"]["required"]


def test_search_knowledge_graph_tool_has_optional_section() -> None:
    from knowledge import KNOWLEDGE_TOOLS
    tool = next(t for t in KNOWLEDGE_TOOLS if t["name"] == "search_knowledge_graph")
    assert "section" in tool["input_schema"]["properties"]
    assert "section" not in tool["input_schema"].get("required", [])


def test_handle_knowledge_tool_routes_search(
    knowledge_root: Path, registry_for_root: dict
) -> None:
    from knowledge import handle_knowledge_tool
    from knowledge_graph import KnowledgeGraph
    from unittest.mock import MagicMock

    mock_kg = MagicMock(spec=KnowledgeGraph)
    mock_kg.available = True
    mock_kg.search.return_value = [
        {"path": "business/index.md", "title": "Business", "summary": "Business products."}
    ]

    result = handle_knowledge_tool(
        "search_knowledge_graph",
        {"query": "business insurance", "section": "business"},
        registry_for_root,
        knowledge_graph=mock_kg,
    )

    mock_kg.search.assert_called_once_with("business insurance", section="business")
    import json
    data = json.loads(result)
    assert data[0]["path"] == "business/index.md"


def test_handle_knowledge_tool_search_returns_empty_when_kg_none(
    knowledge_root: Path, registry_for_root: dict
) -> None:
    from knowledge import handle_knowledge_tool
    result = handle_knowledge_tool(
        "search_knowledge_graph",
        {"query": "anything"},
        registry_for_root,
        knowledge_graph=None,
    )
    import json
    assert json.loads(result) == []
