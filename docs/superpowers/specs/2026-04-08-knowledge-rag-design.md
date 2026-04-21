# Structured Markdown RAG for the Skilled Agent

**Date:** 2026-04-08  
**Status:** Approved

## Overview

Replace VectorDB-based RAG with a structured, filesystem-navigable knowledge base. The agent uses Claude's reasoning to navigate a hierarchy of `SUMMARY.MD` index files — generated from enriched frontmatter — to find and read the specific pages needed to answer a customer query. No vector embeddings, no scoring algorithm, no external search infrastructure.

---

## Knowledge Base Structure

The `knowledge/` directory mirrors the URL structure of the crawled site. Each crawled page is stored as `index.md` with frontmatter. The enrichment script augments this with generated metadata and produces `SUMMARY.MD` files at every directory level.

```
knowledge/
  SUMMARY.MD                          ← root index, injected into system prompt
  index.md                            ← crawled homepage
  business/
    SUMMARY.MD                        ← lists subdirs + pages in business/
    index.md
    group-protection/
      SUMMARY.MD
      index.md
      group-life-insurance/
        SUMMARY.MD
        index.md
      ...
  retirement/
    SUMMARY.MD
    ...
```

### Frontmatter Schema

Each crawled `index.md` has its frontmatter extended by the enrichment script:

```yaml
---
url: https://www.aviva.co.uk/business/group-protection/group-life-insurance/
title: "Group life insurance - Aviva"
summary: "Group life insurance providing a tax-free lump sum to employees' families on death in service, with flexible cover and wellbeing support."
topics: ["group life insurance", "death in service", "employee benefits", "group protection"]
keywords: ["life cover", "death benefit", "bereavement", "lump sum", "trust", "inheritance tax"]
---
```

### SUMMARY.MD Format

Generated at every directory level. Uses uppercase filename to avoid collision with crawled `index.md` files and to work correctly on case-insensitive filesystems (Windows/macOS).

```markdown
# Business

Aviva's insurance, pension, and protection products for employers and businesses.

## Sections

- [Group Protection](group-protection/SUMMARY.MD) — Employee benefits: life, critical illness, and income protection insurance
- [Workplace Pensions](workplace-pensions/SUMMARY.MD) — Pension schemes including GPP, Master Trust, and GSIPP
- [Health Insurance](health-insurance/SUMMARY.MD) — Business PMI and corporate health solutions

## Pages

- [Business overview](index.md) — Entry point for all Aviva employer and business products
```

---

## Components

### 1. `enrich_knowledge.py`

One-time preprocessing script. Run with `uv run python enrich_knowledge.py`. Safe to re-run (idempotent for Phase 1).

**Phase 1 — Frontmatter enrichment:**
- Walk all `knowledge/**/*.md`
- Skip: `SUMMARY.MD`, `README.md`, sitemap files (`sitemap.md`, `sitemap-index.md`, `risksolutions/sitemap.md`, `health-providers/sitemap.md`)
- Skip files that already have all three fields: `summary`, `topics`, `keywords`
- For each remaining file: truncate content to ~3000 words, call Claude (`claude-haiku-4-5-20251001` for cost efficiency) to generate `summary`, `topics`, `keywords`
- Update frontmatter in-place, preserving existing fields

**Phase 2 — SUMMARY.MD generation:**
- Always regenerates (no staleness risk)
- Bottom-up traversal: process leaf directories first, root last
- For each directory:
  - Read frontmatter `summary` from local `index.md` (if present) for the section description
  - List subdirectories, each linking to `subdir/SUMMARY.MD` with its first-line description
  - List local `index.md` pages with their `title` and `summary`
  - Write `SUMMARY.MD`

**CLI flags:**
- `--dry-run` — print what would be written without modifying files
- `--phase1-only` — run frontmatter enrichment only, skip SUMMARY.MD generation
- `--phase2-only` — regenerate SUMMARY.MD files only, skip frontmatter enrichment

---

### 2. `knowledge.py`

Thin module exposing a single tool, its handler, and a source registry used for citations.

**Source registry** — built once at startup by parsing `knowledge/README.md`. The README contains a markdown table with columns `URL`, `Title`, and `File`. File paths in the table carry an `aviva/` prefix (e.g. `aviva/business/group-protection/group-life-insurance/index.md`) which is stripped when building the registry key (e.g. `business/group-protection/group-life-insurance/index.md`).

```python
KNOWLEDGE_ROOT = Path("./knowledge")

def build_source_registry(readme: Path) -> dict[str, dict]:
    """Parse README.md table → {relative_path: {url, title}}."""

def read_knowledge(inp: dict, source_registry: dict) -> str:
    """
    Validate path is within KNOWLEDGE_ROOT, return file content.
    For index.md files, prepend a source header:
      [Source: <title> — <url>]
    so the agent always has attribution context alongside the content.
    """

def handle_knowledge_tool(name: str, inp: dict, source_registry: dict) -> str:
    """Dispatcher — currently only handles read_knowledge."""

KNOWLEDGE_TOOLS = [
    {
        "name": "read_knowledge",
        "description": (
            "Read a file from the knowledge base. "
            "Navigate using SUMMARY.MD files at each directory level "
            "(e.g. 'business/SUMMARY.MD'). "
            "Read a page's index.md for full content once identified."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": (
                        "Relative path from knowledge root. "
                        "Examples: 'business/SUMMARY.MD', "
                        "'business/group-protection/group-life-insurance/index.md'"
                    )
                }
            },
            "required": ["path"]
        }
    }
]
```

Path validation must confirm the resolved absolute path starts with the resolved `KNOWLEDGE_ROOT` to prevent directory traversal.

The source header prepended to `index.md` responses looks like:

```
[Source: Group life insurance - Aviva — https://www.aviva.co.uk/business/group-protection/group-life-insurance/]
```

This ensures the agent always knows the title and URL of every page it reads, without needing a separate lookup tool call.

---

### 3. `agent.py` changes

Minimal diff:

1. Import `KNOWLEDGE_TOOLS`, `handle_knowledge_tool`, and `build_source_registry` from `knowledge.py`
2. At startup: build `source_registry` from `knowledge/README.md`
3. Add `KNOWLEDGE_TOOLS` to `CORE_TOOLS`
4. Add `read_knowledge` routing in the tool dispatch block (passing `source_registry`)
5. Read `knowledge/SUMMARY.MD` at startup and inject into the system prompt, with a citation instruction:

```python
source_registry = build_source_registry(KNOWLEDGE_ROOT / "README.md")
knowledge_index = (KNOWLEDGE_ROOT / "SUMMARY.MD").read_text()

system_prompt = f"""...(existing prompt)...

You also have access to a knowledge base about Aviva's products and services.
Navigate it using read_knowledge with SUMMARY.MD files to explore sections,
then read the specific index.md page once identified.

When answering a customer query, always end your response with a "Sources" 
section listing the title and URL of every index.md file you read, formatted as:

## Sources
- [Page Title](https://url)

<knowledge_index>
{knowledge_index}
</knowledge_index>
"""
```

---

## Agent Navigation Flow

```
Customer query received
        │
        ▼
Root SUMMARY.MD already in system prompt
        │
        ▼
Agent identifies relevant section (e.g. "business/group-protection")
        │
        ▼
read_knowledge("business/group-protection/SUMMARY.MD")
        │
        ▼
Agent identifies specific page
        │
        ▼
read_knowledge("business/group-protection/group-life-insurance/index.md")
        │
        ▼
Agent answers query from page content
```

For broad queries, the agent may read multiple pages before answering.

---

## Error Handling

- `read_knowledge` with an unknown path returns a clear error string (not an exception) so the agent can recover
- Path traversal attempts (e.g. `../../etc/passwd`) return an error without reading
- Missing `knowledge/SUMMARY.MD` at startup raises at boot time with a clear message directing the user to run `enrich_knowledge.py`
- Enrichment script handles Claude API errors per-file with a warning and continues; failed files are reported at the end

---

## Out of Scope

- Real-time knowledge base updates (re-run `enrich_knowledge.py` when content changes)
- Multi-turn conversation memory
- Confidence scoring or fallback to vector search
- Access control on knowledge files
