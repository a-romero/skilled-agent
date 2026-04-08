import textwrap
import pytest
from enrich_knowledge import parse_frontmatter, write_frontmatter

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
