import textwrap
import pytest
from pathlib import Path
from knowledge import build_source_registry

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
