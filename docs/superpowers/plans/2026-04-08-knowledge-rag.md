# Knowledge RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured markdown-based knowledge retrieval to the skilled agent, replacing VectorDB RAG with a navigable hierarchy of `SUMMARY.MD` index files and a `read_knowledge` tool.

**Architecture:** `enrich_knowledge.py` enriches each `knowledge/**/*.md` file's frontmatter with `summary`/`topics`/`keywords` (Phase 1) and generates `SUMMARY.MD` files bottom-up at every directory level (Phase 2). At runtime, `knowledge.py` exposes a single `read_knowledge` tool; the agent navigates via `SUMMARY.MD` files injected into the system prompt. When answering queries the agent cites the title and URL of every page it read, sourced from `knowledge/README.md`.

**Tech Stack:** Python 3.x, `anthropic` SDK, `pyyaml`, `uv`, `pytest`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `knowledge.py` | Create | Source registry builder, `read_knowledge` tool, `KNOWLEDGE_TOOLS` definition |
| `enrich_knowledge.py` | Create | Frontmatter enrichment (Phase 1), `SUMMARY.MD` generation (Phase 2), CLI entry point |
| `agent.py` | Modify | Import and wire up knowledge tools; inject root `SUMMARY.MD` into system prompt |
| `tests/test_knowledge.py` | Create | Unit tests for `knowledge.py` |
| `tests/test_enrich_knowledge.py` | Create | Unit tests for frontmatter utils and SUMMARY.MD generation |

---

## Task 1: Project Setup

**Files:**
- Modify: `pyproject.toml` (created by uv if absent)
- Create: `tests/__init__.py`

- [ ] **Step 1: Add pyyaml dependency**

```bash
uv add pyyaml
```

Expected output: resolves and installs `pyyaml`, creates/updates `pyproject.toml`.

- [ ] **Step 2: Create tests directory**

```bash
mkdir -p tests && touch tests/__init__.py
```

- [ ] **Step 3: Verify pytest works**

```bash
uv run pytest tests/ -v
```

Expected: `no tests ran` — zero failures, clean exit.

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml uv.lock tests/__init__.py
git commit -m "chore: add pyyaml dependency and tests scaffold"
```

---

## Task 2: Source Registry (`knowledge.py`)

**Files:**
- Create: `knowledge.py`
- Create: `tests/test_knowledge.py`

The source registry parses `knowledge/README.md`'s markdown table into a dict keyed by relative file path. File entries in the table carry an `aviva/` prefix that must be stripped.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_knowledge.py`:

```python
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
def source_registry(readme: Path) -> dict:
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/test_knowledge.py -v
```

Expected: `ModuleNotFoundError: No module named 'knowledge'`

- [ ] **Step 3: Implement `build_source_registry` in `knowledge.py`**

Create `knowledge.py`:

```python
"""Knowledge base retrieval tools for the skilled agent."""

from pathlib import Path

KNOWLEDGE_ROOT = Path("./knowledge")


def build_source_registry(readme: Path) -> dict[str, dict]:
    """Parse knowledge/README.md table into {relative_path: {url, title}}."""
    registry: dict[str, dict] = {}
    for line in readme.read_text().splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 3:
            continue
        url, title, file_cell = cells[0], cells[1], cells[2]
        # Skip header and separator rows
        if url == "URL" or not url or set(url) <= {"-", " "}:
            continue
        file_path = file_cell.strip("`").strip()
        if file_path.startswith("aviva/"):
            file_path = file_path[len("aviva/"):]
        if url and title and file_path:
            registry[file_path] = {"url": url, "title": title}
    return registry
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_knowledge.py -v
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add knowledge.py tests/test_knowledge.py
git commit -m "feat: add knowledge source registry parser"
```

---

## Task 3: `read_knowledge` Tool (`knowledge.py`)

**Files:**
- Modify: `knowledge.py`
- Modify: `tests/test_knowledge.py`

`read_knowledge` validates the path stays within `KNOWLEDGE_ROOT`, returns the file content, and prepends a `[Source: ...]` header for `index.md` files found in the source registry.

- [ ] **Step 1: Add failing tests to `tests/test_knowledge.py`**

Append to `tests/test_knowledge.py`:

```python
from knowledge import read_knowledge


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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/test_knowledge.py -v
```

Expected: `ImportError` on `read_knowledge`.

- [ ] **Step 3: Implement `read_knowledge` in `knowledge.py`**

Append to `knowledge.py`:

```python
def read_knowledge(
    inp: dict,
    source_registry: dict,
    knowledge_root: Path = KNOWLEDGE_ROOT,
) -> str:
    """Read a knowledge file; prepend source header for index.md content pages."""
    rel_path = inp.get("path", "").strip()
    resolved_root = knowledge_root.resolve()
    target = (knowledge_root / rel_path).resolve()
    if not str(target).startswith(str(resolved_root)):
        return f"Error: path '{rel_path}' is outside the knowledge root"
    if not target.exists():
        return f"Error: '{rel_path}' not found in knowledge base"
    content = target.read_text()
    if rel_path.endswith("index.md") and rel_path in source_registry:
        source = source_registry[rel_path]
        content = f"[Source: {source['title']} — {source['url']}]\n\n{content}"
    return content
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_knowledge.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add knowledge.py tests/test_knowledge.py
git commit -m "feat: add read_knowledge tool with path validation and source header"
```

---

## Task 4: Tool Definition and Dispatcher (`knowledge.py`)

**Files:**
- Modify: `knowledge.py`
- Modify: `tests/test_knowledge.py`

- [ ] **Step 1: Add failing tests**

Append to `tests/test_knowledge.py`:

```python
from knowledge import handle_knowledge_tool, KNOWLEDGE_TOOLS


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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/test_knowledge.py -v
```

Expected: `ImportError` on `handle_knowledge_tool`, `KNOWLEDGE_TOOLS`.

- [ ] **Step 3: Implement dispatcher and tool definitions in `knowledge.py`**

Append to `knowledge.py`:

```python
def handle_knowledge_tool(
    name: str,
    inp: dict,
    source_registry: dict,
    knowledge_root: Path = KNOWLEDGE_ROOT,
) -> str:
    """Dispatch knowledge tool calls."""
    if name == "read_knowledge":
        return read_knowledge(inp, source_registry, knowledge_root)
    return f"Error: unknown knowledge tool '{name}'"


KNOWLEDGE_TOOLS: list[dict] = [
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
                    ),
                }
            },
            "required": ["path"],
        },
    }
]
```

- [ ] **Step 4: Run all knowledge tests**

```bash
uv run pytest tests/test_knowledge.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add knowledge.py tests/test_knowledge.py
git commit -m "feat: add KNOWLEDGE_TOOLS definition and handle_knowledge_tool dispatcher"
```

---

## Task 5: Agent Integration (`agent.py`)

**Files:**
- Modify: `agent.py`

Wire up `KNOWLEDGE_TOOLS`, `handle_knowledge_tool`, and `build_source_registry` into the agent loop. Inject root `SUMMARY.MD` into the system prompt with a citation instruction.

- [ ] **Step 1: Add imports at top of `agent.py`**

Add after the existing imports:

```python
from knowledge import KNOWLEDGE_TOOLS, handle_knowledge_tool, build_source_registry, KNOWLEDGE_ROOT
```

- [ ] **Step 2: Add `KNOWLEDGE_TOOLS` to `CORE_TOOLS`**

In `agent.py`, `CORE_TOOLS` is the module-level list. Append after the closing `]`:

```python
CORE_TOOLS = [
    {
        "name": "list_skills",
        ...
    },
    {
        "name": "read_skill",
        ...
    },
] + KNOWLEDGE_TOOLS
```

- [ ] **Step 3: Build source registry and load root `SUMMARY.MD` inside `run_agent`**

At the top of `run_agent`, after `registry = build_skill_registry(SKILLS_ROOT)`, add:

```python
source_registry = build_source_registry(KNOWLEDGE_ROOT / "README.md")

knowledge_summary_path = KNOWLEDGE_ROOT / "SUMMARY.MD"
if not knowledge_summary_path.exists():
    raise FileNotFoundError(
        f"{knowledge_summary_path} not found. "
        "Run: uv run python enrich_knowledge.py"
    )
knowledge_index = knowledge_summary_path.read_text()
```

- [ ] **Step 4: Update the system prompt inside `run_agent`**

Replace the existing `system_prompt = f"""..."""` with:

```python
system_prompt = f"""You are a capable AI agent with access to a skill library and a knowledge base.

Skills are organised as markdown files in a filesystem. You must:
1. Call `list_skills` to discover available skills.
2. Call `read_skill` for any skill that looks relevant — read it fully before using it.
3. Follow the instructions in the skill file precisely.
4. Only read a skill if it's actually needed for the task.

You also have access to a knowledge base about Aviva's products and services.
Navigate it using read_knowledge with SUMMARY.MD files to explore sections,
then read the specific index.md page once identified.

When answering a customer query, always end your response with a "Sources"
section listing the title and URL of every index.md file you read:

## Sources
- [Page Title](https://url)

Current working directory: {Path.cwd()}
Available skills root: {SKILLS_ROOT.resolve()}

<knowledge_index>
{knowledge_index}
</knowledge_index>
"""
```

- [ ] **Step 5: Add `read_knowledge` routing in the tool dispatch block**

Inside the `for block in response.content` loop, after the `elif tool_name in SKILL_TOOL_HANDLERS:` branch, add:

```python
elif tool_name == "read_knowledge":
    result = handle_knowledge_tool(tool_name, tool_input, source_registry)
```

- [ ] **Step 6: Smoke-test the agent with a knowledge query**

```bash
uv run python agent.py "What is Aviva's group life insurance and what does it cover?"
```

Expected: agent navigates to `business/group-protection/SUMMARY.MD`, then `business/group-protection/group-life-insurance/index.md`, answers the query, and ends with a `## Sources` section. *(Note: requires `knowledge/SUMMARY.MD` to exist — run `uv run python enrich_knowledge.py --phase2-only` first if needed, or create a stub `knowledge/SUMMARY.MD` manually for this smoke test.)*

- [ ] **Step 7: Commit**

```bash
git add agent.py
git commit -m "feat: integrate knowledge tools and SUMMARY.MD navigation into agent"
```

---

## Task 6: Frontmatter Utilities (`enrich_knowledge.py`)

**Files:**
- Create: `enrich_knowledge.py`
- Create: `tests/test_enrich_knowledge.py`

`parse_frontmatter` and `write_frontmatter` are the foundation for both phases. They must round-trip cleanly.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_enrich_knowledge.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/test_enrich_knowledge.py -v
```

Expected: `ModuleNotFoundError: No module named 'enrich_knowledge'`

- [ ] **Step 3: Implement frontmatter utilities in `enrich_knowledge.py`**

Create `enrich_knowledge.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_enrich_knowledge.py -v
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add enrich_knowledge.py tests/test_enrich_knowledge.py
git commit -m "feat: add frontmatter parse/write utilities"
```

---

## Task 7: SUMMARY.MD Generation (`enrich_knowledge.py`)

**Files:**
- Modify: `enrich_knowledge.py`
- Modify: `tests/test_enrich_knowledge.py`

Phase 2 walks the knowledge tree bottom-up and generates a `SUMMARY.MD` at each directory level listing sections (subdirectories) and pages (local `index.md`).

- [ ] **Step 1: Add failing tests**

Append to `tests/test_enrich_knowledge.py`:

```python
from pathlib import Path
from enrich_knowledge import generate_summary_for_dir, generate_all_summaries


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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/test_enrich_knowledge.py -v
```

Expected: `ImportError` on `generate_summary_for_dir`, `generate_all_summaries`.

- [ ] **Step 3: Implement Phase 2 in `enrich_knowledge.py`**

Append to `enrich_knowledge.py`:

```python
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
```

- [ ] **Step 4: Run all tests**

```bash
uv run pytest tests/test_enrich_knowledge.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add enrich_knowledge.py tests/test_enrich_knowledge.py
git commit -m "feat: add SUMMARY.MD generation (Phase 2)"
```

---

## Task 8: Frontmatter Enrichment via Claude (`enrich_knowledge.py`)

**Files:**
- Modify: `enrich_knowledge.py`
- Modify: `tests/test_enrich_knowledge.py`

Phase 1 calls Claude Haiku to generate `summary`, `topics`, and `keywords` for each unenriched file. The test mocks the Anthropic client.

- [ ] **Step 1: Add failing tests**

Append to `tests/test_enrich_knowledge.py`:

```python
import textwrap
from unittest.mock import MagicMock, patch
from enrich_knowledge import enrich_file, _needs_enrichment, _should_skip


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


def test_enrich_file_skips_already_enriched(tmp_path: Path) -> None:
    p = tmp_path / "index.md"
    p.write_text(
        "---\ntitle: Test\nsummary: Already there.\ntopics:\n- t\nkeywords:\n- k\n---\nContent."
    )
    mock_client = MagicMock()
    result = enrich_file(p, mock_client)
    assert result is False
    mock_client.messages.create.assert_not_called()


def test_enrich_file_calls_claude_and_writes_fields(tmp_path: Path) -> None:
    p = tmp_path / "index.md"
    p.write_text("---\ntitle: Test Page\n---\nSome content about insurance.")

    mock_response = MagicMock()
    mock_response.content = [
        MagicMock(
            text=textwrap.dedent("""\
                summary: "A page about insurance."
                topics:
                  - insurance
                keywords:
                  - cover
            """)
        )
    ]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    result = enrich_file(p, mock_client)

    assert result is True
    fm, _ = parse_frontmatter(p.read_text())
    assert fm["summary"] == "A page about insurance."
    assert "insurance" in fm["topics"]
    assert "cover" in fm["keywords"]


def test_enrich_file_dry_run_does_not_write(tmp_path: Path) -> None:
    p = tmp_path / "index.md"
    original = "---\ntitle: Test\n---\nContent."
    p.write_text(original)

    mock_response = MagicMock()
    mock_response.content = [
        MagicMock(text="summary: 'S'\ntopics:\n  - t\nkeywords:\n  - k\n")
    ]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    enrich_file(p, mock_client, dry_run=True)
    assert p.read_text() == original
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/test_enrich_knowledge.py -v
```

Expected: `ImportError` on `enrich_file`, `_needs_enrichment`, `_should_skip`.

- [ ] **Step 3: Implement Phase 1 in `enrich_knowledge.py`**

Append to `enrich_knowledge.py`:

```python
import anthropic


def _should_skip(path: Path) -> bool:
    """Return True for files that should not be enriched."""
    if path.name in _SKIP_NAMES:
        return True
    return any(pattern in path.name for pattern in _SKIP_PATTERNS)


def _needs_enrichment(fm: dict) -> bool:
    """Return True if any of the three enrichment fields are missing."""
    return not all(k in fm for k in ("summary", "topics", "keywords"))


def enrich_file(
    path: Path, client: anthropic.Anthropic, dry_run: bool = False
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

    if dry_run:
        print(f"[dry-run] Would enrich {path}")
        return True

    path.write_text(write_frontmatter(fm, body))
    return True


def run_phase1(knowledge_root: Path, dry_run: bool = False) -> None:
    """Enrich all unenriched knowledge files."""
    client = anthropic.Anthropic()
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
```

- [ ] **Step 4: Run all tests**

```bash
uv run pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add enrich_knowledge.py tests/test_enrich_knowledge.py
git commit -m "feat: add Phase 1 frontmatter enrichment via Claude Haiku"
```

---

## Task 9: CLI Entry Point (`enrich_knowledge.py`)

**Files:**
- Modify: `enrich_knowledge.py`

Wire `run_phase1` and `generate_all_summaries` together with `argparse`.

- [ ] **Step 1: Append CLI to `enrich_knowledge.py`**

```python
import argparse
import sys


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
```

- [ ] **Step 2: Test `--help` works**

```bash
uv run python enrich_knowledge.py --help
```

Expected output includes `--dry-run`, `--phase1-only`, `--phase2-only`.

- [ ] **Step 3: Test `--phase2-only --dry-run` (no API key needed)**

```bash
uv run python enrich_knowledge.py --phase2-only --dry-run
```

Expected: prints `[dry-run] Would write knowledge/...SUMMARY.MD` for each directory. No files written.

- [ ] **Step 4: Run full test suite**

```bash
uv run pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add enrich_knowledge.py
git commit -m "feat: add CLI entry point with --dry-run, --phase1-only, --phase2-only flags"
```

---

## Task 10: Run Enrichment and Verify End-to-End

- [ ] **Step 1: Generate SUMMARY.MD files**

```bash
uv run python enrich_knowledge.py --phase2-only
```

Expected: creates `knowledge/SUMMARY.MD` and a `SUMMARY.MD` in every subdirectory. Prints `Generated knowledge/.../SUMMARY.MD` for each.

- [ ] **Step 2: Verify root SUMMARY.MD looks correct**

```bash
head -30 knowledge/SUMMARY.MD
```

Expected: heading `# Knowledge Base`, a `## Sections` block listing top-level directories (business, retirement, etc.) each with a `SUMMARY.MD` link.

- [ ] **Step 3: Run full test suite one last time**

```bash
uv run pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 4: Run a live agent query (requires `ANTHROPIC_API_KEY`)**

```bash
uv run python agent.py "What group life insurance does Aviva offer for employers?"
```

Expected: agent reads `business/group-protection/SUMMARY.MD`, then `business/group-protection/group-life-insurance/index.md`, answers the query, ends with `## Sources` containing the page title and URL.

- [ ] **Step 5: Commit SUMMARY.MD files**

```bash
git add knowledge/
git commit -m "chore: generate initial SUMMARY.MD navigation files"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|-----------|
| Enrich frontmatter with `summary`, `topics`, `keywords` | Task 8 (`enrich_file`, `run_phase1`) |
| Skip already-enriched files (idempotent) | Task 8 (`_needs_enrichment`) |
| `--dry-run`, `--phase1-only`, `--phase2-only` flags | Task 9 |
| Generate `SUMMARY.MD` at every directory level | Task 7 (`generate_all_summaries`) |
| Bottom-up traversal | Task 7 (sorted by depth desc) |
| Root `SUMMARY.MD` injected into system prompt | Task 5 |
| `read_knowledge` tool with path validation | Task 3 |
| Directory traversal prevention | Task 3 |
| Source header prepended to `index.md` responses | Task 3 |
| Parse `knowledge/README.md` for source registry | Task 2 |
| Strip `aviva/` prefix from README file paths | Task 2 |
| Agent cites sources at end of response | Task 5 (system prompt instruction) |
| `FileNotFoundError` if `SUMMARY.MD` missing at boot | Task 5 |
| Error recovery in enrichment (per-file, continue on failure) | Task 8 (`run_phase1`) |
| `SUMMARY.MD` uppercase to avoid collision and Windows compat | All tasks |
