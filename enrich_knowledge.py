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


def _section_heading(directory: Path, knowledge_root: Path) -> str:
    """Human-readable heading for a directory."""
    if directory.resolve() == knowledge_root.resolve():
        return "Knowledge Base"
    return directory.name.replace("-", " ").title()


def generate_summary_for_dir(directory: Path, knowledge_root: Path) -> str:
    """Generate SUMMARY.MD content for one directory."""
    sections: list[str] = []
    pages: list[str] = []

    for subdir in sorted(d for d in directory.iterdir() if d.is_dir()):
        sub_summary = subdir / "SUMMARY.MD"
        if not sub_summary.exists():
            continue
        lines = sub_summary.read_text().splitlines()
        desc = next(
            (l.strip() for l in lines if l.strip() and not l.startswith("#")), ""
        )
        label = subdir.name.replace("-", " ").title()
        sections.append(f"- [{label}]({subdir.name}/SUMMARY.MD) — {desc}")

    index_file = directory / "index.md"
    if index_file.exists():
        fm, _ = parse_frontmatter(index_file.read_text())
        title = fm.get("title", "Overview")
        summary = fm.get("summary", "")
        pages.append(f"- [{title}](index.md) — {summary}")

    heading = _section_heading(directory, knowledge_root)
    section_desc = ""
    if index_file.exists():
        fm, _ = parse_frontmatter(index_file.read_text())
        section_desc = fm.get("summary", "")

    out: list[str] = [f"# {heading}", ""]
    if section_desc:
        out += [section_desc, ""]
    if sections:
        out += ["## Sections", ""] + sections + [""]
    if pages:
        out += ["## Pages", ""] + pages + [""]

    return "\n".join(out)


def generate_all_summaries(knowledge_root: Path, dry_run: bool = False) -> None:
    """Generate SUMMARY.MD files bottom-up across the knowledge tree."""
    all_dirs = sorted(
        [d for d in knowledge_root.rglob("*") if d.is_dir()],
        key=lambda d: len(d.parts),
        reverse=True,
    )
    all_dirs.append(knowledge_root)

    for directory in all_dirs:
        content = generate_summary_for_dir(directory, knowledge_root)
        target = directory / "SUMMARY.MD"
        if dry_run:
            print(f"[dry-run] Would write {target}")
            print(content[:300])
        else:
            target.write_text(content)
            print(f"Generated {target}")
