"""Enrich knowledge base frontmatter and generate SUMMARY.MD navigation files."""

import argparse
import sys

import anthropic
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
            (
                l.strip()
                for l in lines
                if l.strip()
                and not l.startswith("#")
                and not l.startswith("-")
                and not l.startswith("[")
                and not l.startswith("##")
            ),
            "",
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


def _should_skip(path: Path) -> bool:
    """Return True for files that should not be enriched."""
    if path.name in _SKIP_NAMES:
        return True
    return any(pattern in path.name for pattern in _SKIP_PATTERNS)


def _needs_enrichment(fm: dict) -> bool:
    """Return True if any of the three enrichment fields are missing."""
    return not all(k in fm for k in ("summary", "topics", "keywords"))


def enrich_file(
    path: Path, client: anthropic.Anthropic | None, dry_run: bool = False
) -> bool:
    """Enrich a file's frontmatter with summary/topics/keywords. Returns True if modified."""
    text = path.read_text()
    fm, body = parse_frontmatter(text)

    if not _needs_enrichment(fm):
        return False

    words = body.split()
    truncated = " ".join(words[:3000])
    title = fm.get("title", path.stem)

    prompt = (
        f"Given this web page content, generate structured metadata.\n\n"
        f"Page title: {title}\n"
        f"Content:\n{truncated}\n\n"
        "Respond with YAML only — no explanation, no markdown fences:\n"
        'summary: "1-2 sentences describing what this page covers"\n'
        "topics:\n"
        '  - "topic 1"\n'
        "keywords:\n"
        '  - "keyword 1"\n'
    )

    if dry_run:
        print(f"[dry-run] Would enrich {path}")
        return True

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        result = yaml.safe_load(response.content[0].text) or {}
    except yaml.YAMLError:
        print(f"  Warning: could not parse Claude response for {path}")
        return False

    fm["summary"] = result.get("summary", "")
    fm["topics"] = result.get("topics", [])
    fm["keywords"] = result.get("keywords", [])

    path.write_text(write_frontmatter(fm, body))
    return True


def run_phase1(knowledge_root: Path, dry_run: bool = False) -> None:
    """Enrich all unenriched knowledge files."""
    client = anthropic.Anthropic() if not dry_run else None
    files = sorted(
        p for p in knowledge_root.rglob("*.md") if not _should_skip(p)
    )
    failed: list[Path] = []

    for path in files:
        try:
            modified = enrich_file(path, client, dry_run)
            status = "enriched" if modified else "skipped"
            print(f"  {status}: {path.relative_to(knowledge_root)}")
        except Exception as exc:
            print(f"  Error: {path} — {exc}")
            failed.append(path)

    if failed:
        print(f"\nFailed ({len(failed)}):")
        for p in failed:
            print(f"  {p}")


def main() -> None:
    """CLI entry point for knowledge base enrichment."""
    parser = argparse.ArgumentParser(
        description="Enrich knowledge base frontmatter and generate SUMMARY.MD files."
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview without writing any files"
    )
    parser.add_argument(
        "--phase1-only", action="store_true", help="Run frontmatter enrichment only"
    )
    parser.add_argument(
        "--phase2-only", action="store_true", help="Run SUMMARY.MD generation only"
    )
    args = parser.parse_args()

    if args.phase1_only and args.phase2_only:
        print(
            "Error: --phase1-only and --phase2-only are mutually exclusive",
            file=sys.stderr,
        )
        sys.exit(1)

    knowledge_root = Path("./knowledge")
    if not knowledge_root.exists():
        print(f"Error: knowledge root '{knowledge_root}' not found", file=sys.stderr)
        sys.exit(1)

    run_phase1_flag = not args.phase2_only
    run_phase2_flag = not args.phase1_only

    if run_phase1_flag:
        print("Phase 1: Enriching frontmatter...")
        run_phase1(knowledge_root, dry_run=args.dry_run)

    if run_phase2_flag:
        print("\nPhase 2: Generating SUMMARY.MD files...")
        generate_all_summaries(knowledge_root, dry_run=args.dry_run)

    print("\nDone.")


if __name__ == "__main__":
    main()
