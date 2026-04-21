import textwrap
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from enrich_knowledge import (
    parse_frontmatter,
    write_frontmatter,
    generate_summary_for_dir,
    generate_all_summaries,
    enrich_file,
    _needs_enrichment,
    _should_skip,
)

ENRICHED_MD = textwrap.dedent("""\
    ---
    url: https://www.aviva.co.uk/business/
    title: Business - Aviva
    summary: Products for employers.
    topics:
    - business insurance
    keywords:
    - insurance
    ---

    Page content here.
""")

UNENRICHED_MD = textwrap.dedent("""\
    ---
    url: https://www.aviva.co.uk/business/
    title: Business - Aviva
    ---

    Page content here.
""")

NO_FRONTMATTER_MD = "Just plain text with no frontmatter."


def test_parse_frontmatter_returns_dict() -> None:
    fm, body = parse_frontmatter(ENRICHED_MD)
    assert fm["title"] == "Business - Aviva"
    assert fm["summary"] == "Products for employers."
    assert isinstance(fm["topics"], list)
    assert "Page content here." in body


def test_parse_frontmatter_no_frontmatter() -> None:
    fm, body = parse_frontmatter(NO_FRONTMATTER_MD)
    assert fm == {}
    assert body == NO_FRONTMATTER_MD


def test_parse_frontmatter_missing_fields() -> None:
    fm, _ = parse_frontmatter(UNENRICHED_MD)
    assert "summary" not in fm
    assert "topics" not in fm


def test_write_frontmatter_round_trips() -> None:
    fm, body = parse_frontmatter(ENRICHED_MD)
    result = write_frontmatter(fm, body)
    fm2, body2 = parse_frontmatter(result)
    assert fm2["title"] == fm["title"]
    assert fm2["summary"] == fm["summary"]
    assert body2 == body


def test_write_frontmatter_preserves_body() -> None:
    fm, body = parse_frontmatter(UNENRICHED_MD)
    fm["summary"] = "Added summary."
    result = write_frontmatter(fm, body)
    assert "Page content here." in result
    assert "Added summary." in result


@pytest.fixture
def knowledge_tree(tmp_path: Path) -> Path:
    root = tmp_path / "knowledge"
    root.mkdir()
    (root / "index.md").write_text(
        "---\ntitle: Aviva\nsummary: Homepage.\n---\nContent."
    )
    biz = root / "business"
    biz.mkdir()
    (biz / "index.md").write_text(
        "---\ntitle: Business\nsummary: Products for employers.\n---\nContent."
    )
    gp = biz / "group-protection"
    gp.mkdir()
    (gp / "index.md").write_text(
        "---\ntitle: Group Protection\nsummary: Group protection products.\n---\nContent."
    )
    return root


def test_generate_summary_for_dir_includes_page_title(knowledge_tree: Path) -> None:
    gp = knowledge_tree / "business" / "group-protection"
    content = generate_summary_for_dir(gp, knowledge_tree)
    assert "Group Protection" in content


def test_generate_summary_for_dir_includes_page_summary(knowledge_tree: Path) -> None:
    gp = knowledge_tree / "business" / "group-protection"
    content = generate_summary_for_dir(gp, knowledge_tree)
    assert "Group protection products." in content


def test_generate_summary_for_dir_links_subdir_summary(knowledge_tree: Path) -> None:
    # First generate leaf SUMMARY.MD so parent can reference it
    gp = knowledge_tree / "business" / "group-protection"
    (gp / "SUMMARY.MD").write_text("# Group Protection\n\nGroup protection products.\n")
    content = generate_summary_for_dir(knowledge_tree / "business", knowledge_tree)
    assert "group-protection/SUMMARY.MD" in content


def test_generate_all_summaries_creates_files(knowledge_tree: Path) -> None:
    generate_all_summaries(knowledge_tree)
    assert (knowledge_tree / "SUMMARY.MD").exists()
    assert (knowledge_tree / "business" / "SUMMARY.MD").exists()
    assert (knowledge_tree / "business" / "group-protection" / "SUMMARY.MD").exists()


def test_generate_all_summaries_root_references_business(knowledge_tree: Path) -> None:
    generate_all_summaries(knowledge_tree)
    root_content = (knowledge_tree / "SUMMARY.MD").read_text()
    assert "business/SUMMARY.MD" in root_content


def test_generate_all_summaries_does_not_create_nested_summary_md(
    knowledge_tree: Path,
) -> None:
    generate_all_summaries(knowledge_tree)
    # SUMMARY.MD itself should not appear as a page entry
    root_content = (knowledge_tree / "SUMMARY.MD").read_text()
    assert "SUMMARY.MD](SUMMARY.MD)" not in root_content


def test_needs_enrichment_true_when_fields_missing() -> None:
    fm = {"url": "https://example.com", "title": "Test"}
    assert _needs_enrichment(fm) is True


def test_needs_enrichment_false_when_all_present() -> None:
    fm = {"summary": "s", "topics": ["t"], "keywords": ["k"]}
    assert _needs_enrichment(fm) is False


def test_should_skip_summary_md() -> None:
    assert _should_skip(Path("knowledge/SUMMARY.MD")) is True


def test_should_skip_readme() -> None:
    assert _should_skip(Path("knowledge/README.md")) is True


def test_should_skip_sitemap() -> None:
    assert _should_skip(Path("knowledge/sitemap.md")) is True


def test_should_not_skip_index_md() -> None:
    assert _should_skip(Path("knowledge/business/index.md")) is False


@patch("enrich_knowledge.complete")
def test_enrich_file_skips_already_enriched(mock_complete: MagicMock, tmp_path: Path) -> None:
    p = tmp_path / "index.md"
    p.write_text(
        "---\ntitle: Test\nsummary: Already there.\ntopics:\n- t\nkeywords:\n- k\n---\nContent."
    )
    mock_client = MagicMock()
    result = enrich_file(p, mock_client)
    assert result is False
    mock_complete.assert_not_called()


@patch("enrich_knowledge.complete")
def test_enrich_file_calls_claude_and_writes_fields(mock_complete: MagicMock, tmp_path: Path) -> None:
    p = tmp_path / "index.md"
    p.write_text("---\ntitle: Test Page\n---\nSome content about insurance.")

    mock_complete.return_value = MagicMock(
        text=textwrap.dedent("""\
            summary: "A page about insurance."
            topics:
              - insurance
            keywords:
              - cover
        """)
    )
    mock_client = MagicMock()

    result = enrich_file(p, mock_client)

    assert result is True
    mock_complete.assert_called_once()
    fm, _ = parse_frontmatter(p.read_text())
    assert fm["summary"] == "A page about insurance."
    assert "insurance" in fm["topics"]
    assert "cover" in fm["keywords"]


@patch("enrich_knowledge.complete")
def test_enrich_file_strips_markdown_code_fences(mock_complete: MagicMock, tmp_path: Path) -> None:
    p = tmp_path / "index.md"
    p.write_text("---\ntitle: Test Page\n---\nSome content.")

    mock_complete.return_value = MagicMock(
        text=textwrap.dedent("""\
            ```yaml
            summary: "A page about insurance."
            topics:
              - insurance
            keywords:
              - cover
            ```
        """)
    )
    mock_client = MagicMock()

    result = enrich_file(p, mock_client)

    assert result is True
    fm, _ = parse_frontmatter(p.read_text())
    assert fm["summary"] == "A page about insurance."
    assert "insurance" in fm["topics"]


@patch("enrich_knowledge.complete")
def test_enrich_file_dry_run_does_not_write(mock_complete: MagicMock, tmp_path: Path) -> None:
    p = tmp_path / "index.md"
    original = "---\ntitle: Test\n---\nContent."
    p.write_text(original)

    enrich_file(p, MagicMock(), dry_run=True)
    assert p.read_text() == original
    mock_complete.assert_not_called()
