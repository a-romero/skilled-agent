"""Enrich knowledge base frontmatter and generate SUMMARY.MD navigation files."""

import yaml
from pathlib import Path

# Files to skip during enrichment and SUMMARY.MD generation
_SKIP_NAMES: frozenset[str] = frozenset({"SUMMARY.MD", "README.md"})
_SKIP_PATTERNS: tuple[str, ...] = ("sitemap",)


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Split markdown into (frontmatter_dict, body). Returns ({}, text) if no frontmatter."""
    if not text.startswith("---"):
        return {}, text
    try:
        end = text.index("---", 3)
    except ValueError:
        return {}, text
    fm_text = text[3:end]
    body = text[end + 3:]
    return yaml.safe_load(fm_text) or {}, body


def write_frontmatter(fm: dict, body: str) -> str:
    """Reconstruct markdown with updated frontmatter."""
    fm_text = yaml.dump(
        fm, allow_unicode=True, default_flow_style=False, sort_keys=False
    )
    return f"---\n{fm_text}---{body}"
