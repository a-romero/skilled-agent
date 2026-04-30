# Knowledge Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace sequential SUMMARY.MD navigation with a single `search_knowledge_graph` tool call backed by Kuzu (embedded graph DB) and BM25 text ranking.

**Architecture:** A new `knowledge_graph.py` module owns graph population (`populate()`) and runtime search (`KnowledgeGraph`). `enrich_knowledge.py` gains a Phase 3 that calls `populate()`. `knowledge.py` exposes the new tool and routes calls. `agent.py` instantiates `KnowledgeGraph` at startup and threads it through.

**Tech Stack:** `kuzu` (embedded graph DB, Cypher), `rank-bm25` (pure-Python BM25), existing `enrich_knowledge.py` pipeline.

---

## File Map

| File | Change | Responsibility |
|------|--------|----------------|
| `knowledge_graph.py` | **Create** | Graph schema, `populate()`, `KnowledgeGraph` class with BM25 |
| `tests/test_knowledge_graph.py` | **Create** | Tests for graph population and search |
| `enrich_knowledge.py` | **Modify** | Add `run_phase3()`, `--phase3-only` CLI flag |
| `knowledge.py` | **Modify** | Add `search_knowledge_graph` tool, update `handle_knowledge_tool` |
| `agent.py` | **Modify** | Instantiate `KnowledgeGraph`, thread through to tool handler, update system prompt |
| `skills/KNOWLEDGE-GRAPH/SKILL.md` | **Create** | Agent skill for using the graph |
| `pyproject.toml` | **Modify** | Add `kuzu`, `rank-bm25` dependencies |

---

### Task 1: Add dependencies

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Add packages**

```bash
uv add kuzu rank-bm25
```

- [ ] **Step 2: Verify installation**

```bash
uv run python -c "import kuzu; import rank_bm25; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add pyproject.toml uv.lock
git commit -m "chore: add kuzu and rank-bm25 dependencies"
```

---

### Task 2: Create `knowledge_graph.py` — schema and population

**Files:**
- Create: `knowledge_graph.py`
- Create: `tests/test_knowledge_graph.py` (partial — population tests only)

- [ ] **Step 1: Write failing tests for graph population**

Create `tests/test_knowledge_graph.py`:

```python
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
    from knowledge_graph import populate, KnowledgeGraph
    populate(two_nodes, graph_dir)
    populate(two_nodes, graph_dir)  # second run must not raise
    kg = KnowledgeGraph(graph_dir)
    assert kg.available
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/test_knowledge_graph.py -v
```

Expected: `ModuleNotFoundError: No module named 'knowledge_graph'`

- [ ] **Step 3: Create `knowledge_graph.py` with schema and `populate()`**

```python
"""Knowledge graph backed by Kuzu with BM25 search over enriched knowledge pages."""

import shutil
from pathlib import Path

import kuzu

GRAPH_ROOT = Path(__file__).parent / "knowledge_graph"


def _create_schema(conn: kuzu.Connection) -> None:
    """Create node and relationship tables."""
    conn.execute(
        "CREATE NODE TABLE Page("
        "path STRING, title STRING, summary STRING, "
        "topics STRING[], keywords STRING[], url STRING, "
        "section STRING, depth INT64, PRIMARY KEY (path)"
        ")"
    )
    conn.execute("CREATE REL TABLE CHILD_OF(FROM Page TO Page)")


def populate(nodes: list[dict], graph_dir: Path = GRAPH_ROOT) -> None:
    """(Re)build the graph from node dicts. Idempotent: drops and rebuilds each run.

    Each node dict must have keys: path, title, summary, topics, keywords, url, section, depth.
    CHILD_OF edges are derived from path structure: each node links to its nearest
    ancestor that also has an index.md in the node set.
    """
    if graph_dir.exists():
        shutil.rmtree(graph_dir)

    db = kuzu.Database(str(graph_dir))
    conn = kuzu.Connection(db)
    _create_schema(conn)

    paths_inserted = {n["path"] for n in nodes}

    for node in nodes:
        conn.execute(
            "CREATE (p:Page {path: $path, title: $title, summary: $summary, "
            "topics: $topics, keywords: $keywords, url: $url, "
            "section: $section, depth: $depth})",
            {
                "path": node["path"],
                "title": node["title"],
                "summary": node["summary"],
                "topics": node["topics"],
                "keywords": node["keywords"],
                "url": node["url"],
                "section": node["section"],
                "depth": node["depth"],
            },
        )

    for node in nodes:
        rel = Path(node["path"])
        # Walk up from the parent directory to find nearest ancestor index.md
        parent = rel.parent.parent  # e.g. business/workplace-pensions for .../index.md
        while str(parent) != ".":
            ancestor_path = str(parent / "index.md")
            if ancestor_path in paths_inserted:
                conn.execute(
                    "MATCH (child:Page {path: $child}), (par:Page {path: $par}) "
                    "CREATE (child)-[:CHILD_OF]->(par)",
                    {"child": node["path"], "par": ancestor_path},
                )
                break
            parent = parent.parent
```

- [ ] **Step 4: Run population tests**

```bash
uv run pytest tests/test_knowledge_graph.py::test_populate_creates_graph_directory tests/test_knowledge_graph.py::test_populate_is_idempotent -v
```

Expected: both PASS

- [ ] **Step 5: Commit**

```bash
git add knowledge_graph.py tests/test_knowledge_graph.py
git commit -m "feat: add knowledge_graph module with Kuzu schema and populate()"
```

---

### Task 3: Add `KnowledgeGraph` class with BM25 search

**Files:**
- Modify: `knowledge_graph.py`
- Modify: `tests/test_knowledge_graph.py`

- [ ] **Step 1: Write failing search tests**

Append to `tests/test_knowledge_graph.py`:

```python
def test_search_returns_relevant_result(graph_dir: Path, two_nodes: list[dict]) -> None:
    from knowledge_graph import populate, KnowledgeGraph
    populate(two_nodes, graph_dir)
    kg = KnowledgeGraph(graph_dir)
    results = kg.search("home contents insurance")
    assert len(results) >= 1
    assert results[0]["path"] == "insurance/home-insurance/index.md"


def test_search_with_section_scopes_results(graph_dir: Path, two_nodes: list[dict]) -> None:
    from knowledge_graph import populate, KnowledgeGraph
    populate(two_nodes, graph_dir)
    kg = KnowledgeGraph(graph_dir)
    results = kg.search("pension annuity", section="business")
    assert all(r["path"].startswith("business/") for r in results)


def test_search_section_excludes_wrong_section(graph_dir: Path, two_nodes: list[dict]) -> None:
    from knowledge_graph import populate, KnowledgeGraph
    populate(two_nodes, graph_dir)
    kg = KnowledgeGraph(graph_dir)
    # Searching business section for home insurance should return nothing
    results = kg.search("home contents insurance", section="business")
    assert not any(r["path"].startswith("insurance/") for r in results)


def test_search_returns_empty_when_graph_missing(tmp_path: Path) -> None:
    from knowledge_graph import KnowledgeGraph
    kg = KnowledgeGraph(tmp_path / "nonexistent")
    assert kg.search("anything") == []


def test_search_result_has_required_keys(graph_dir: Path, two_nodes: list[dict]) -> None:
    from knowledge_graph import populate, KnowledgeGraph
    populate(two_nodes, graph_dir)
    kg = KnowledgeGraph(graph_dir)
    results = kg.search("insurance")
    assert results
    assert all({"path", "title", "summary"} <= set(r.keys()) for r in results)


def test_search_respects_top_k(graph_dir: Path, two_nodes: list[dict]) -> None:
    from knowledge_graph import populate, KnowledgeGraph
    populate(two_nodes, graph_dir)
    kg = KnowledgeGraph(graph_dir)
    results = kg.search("insurance pension home annuity", top_k=1)
    assert len(results) <= 1
```

- [ ] **Step 2: Run to verify they fail**

```bash
uv run pytest tests/test_knowledge_graph.py -k "search" -v
```

Expected: `ImportError` or `AttributeError: 'module' has no attribute 'KnowledgeGraph'`

- [ ] **Step 3: Add `KnowledgeGraph` class to `knowledge_graph.py`**

Append after `populate()`:

```python
class KnowledgeGraph:
    """Runtime interface: loads all Page nodes into memory and provides BM25 search."""

    def __init__(self, graph_dir: Path = GRAPH_ROOT) -> None:
        self._docs: list[dict] = []
        self._bm25 = None
        if not graph_dir.exists():
            return
        db = kuzu.Database(str(graph_dir))
        conn = kuzu.Connection(db)
        self._load(conn)

    def _load(self, conn: kuzu.Connection) -> None:
        result = conn.execute(
            "MATCH (p:Page) "
            "RETURN p.path, p.title, p.summary, p.topics, p.keywords, p.section"
        )
        rows: list[dict] = []
        while result.has_next():
            r = result.get_next()
            rows.append({
                "path": r[0],
                "title": r[1] or "",
                "summary": r[2] or "",
                "topics": r[3] or [],
                "keywords": r[4] or [],
                "section": r[5] or "",
            })
        self._docs = rows
        if rows:
            from rank_bm25 import BM25Okapi
            corpus = [self._text(d).split() for d in rows]
            self._bm25 = BM25Okapi(corpus)

    def _text(self, doc: dict) -> str:
        topics = " ".join(doc["topics"])
        keywords = " ".join(doc["keywords"])
        return f"{doc['title']} {doc['summary']} {topics} {keywords}"

    @property
    def available(self) -> bool:
        """True if the graph was loaded and contains nodes."""
        return bool(self._docs)

    def search(
        self,
        query: str,
        section: str | None = None,
        top_k: int = 5,
    ) -> list[dict]:
        """Return up to top_k pages ranked by BM25 relevance.

        Each result is a dict with keys: path, title, summary.
        Returns [] if the graph is unavailable or no results score above zero.
        """
        if not self.available:
            return []

        candidates = (
            [d for d in self._docs if d["section"] == section]
            if section
            else self._docs
        )
        if not candidates:
            return []

        from rank_bm25 import BM25Okapi
        if section:
            bm25 = BM25Okapi([self._text(c).split() for c in candidates])
        else:
            bm25 = self._bm25

        scores = bm25.get_scores(query.split())
        ranked = sorted(zip(scores, candidates), key=lambda x: x[0], reverse=True)
        return [
            {"path": d["path"], "title": d["title"], "summary": d["summary"]}
            for score, d in ranked[:top_k]
            if score > 0
        ]
```

- [ ] **Step 4: Run all knowledge graph tests**

```bash
uv run pytest tests/test_knowledge_graph.py -v
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add knowledge_graph.py tests/test_knowledge_graph.py
git commit -m "feat: add KnowledgeGraph class with BM25 search"
```

---

### Task 4: Add Phase 3 to `enrich_knowledge.py`

**Files:**
- Modify: `enrich_knowledge.py`
- Modify: `tests/test_enrich_knowledge.py`

- [ ] **Step 1: Write failing Phase 3 tests**

Append to `tests/test_enrich_knowledge.py`:

```python
def test_run_phase3_creates_graph(tmp_path: Path) -> None:
    from enrich_knowledge import run_phase3

    root = tmp_path / "knowledge"
    root.mkdir()
    biz = root / "business"
    biz.mkdir()
    (biz / "index.md").write_text(
        "---\ntitle: Business\nsummary: Business products.\n"
        "topics:\n- business\nkeywords:\n- employer\nurl: https://example.com\n---\n\nContent."
    )
    graph_dir = tmp_path / "kg"
    run_phase3(root, dry_run=False, graph_dir=graph_dir)
    assert graph_dir.exists()


def test_run_phase3_dry_run_does_not_create_graph(tmp_path: Path) -> None:
    from enrich_knowledge import run_phase3

    root = tmp_path / "knowledge"
    root.mkdir()
    (root / "index.md").write_text(
        "---\ntitle: Root\nsummary: Root.\ntopics: []\nkeywords: []\nurl: https://example.com\n---\n"
    )
    graph_dir = tmp_path / "kg"
    run_phase3(root, dry_run=True, graph_dir=graph_dir)
    assert not graph_dir.exists()


def test_run_phase3_populates_searchable_nodes(tmp_path: Path) -> None:
    from enrich_knowledge import run_phase3
    from knowledge_graph import KnowledgeGraph

    root = tmp_path / "knowledge"
    root.mkdir()
    biz = root / "business"
    biz.mkdir()
    (biz / "index.md").write_text(
        "---\ntitle: Business\nsummary: Products for employers.\n"
        "topics:\n- business insurance\nkeywords:\n- employer\nurl: https://example.com\n---\n\nContent."
    )
    graph_dir = tmp_path / "kg"
    run_phase3(root, dry_run=False, graph_dir=graph_dir)

    kg = KnowledgeGraph(graph_dir)
    results = kg.search("employer business insurance")
    assert any(r["path"] == "business/index.md" for r in results)
```

- [ ] **Step 2: Run to verify they fail**

```bash
uv run pytest tests/test_enrich_knowledge.py -k "phase3" -v
```

Expected: `ImportError: cannot import name 'run_phase3'`

- [ ] **Step 3: Add `run_phase3()` to `enrich_knowledge.py`**

Add after `run_phase1()`:

```python
def run_phase3(
    knowledge_root: Path,
    dry_run: bool = False,
    graph_dir: Path | None = None,
) -> None:
    """Populate knowledge graph from enriched index.md files."""
    from knowledge_graph import populate, GRAPH_ROOT

    _graph_dir = graph_dir or GRAPH_ROOT
    files = sorted(p for p in knowledge_root.rglob("index.md") if not _should_skip(p))
    nodes: list[dict] = []

    for path in files:
        fm, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
        rel = path.relative_to(knowledge_root)
        parts = rel.parts  # e.g. ('business', 'workplace-pensions', 'index.md')
        section = parts[0] if len(parts) > 1 else ""
        depth = len(parts) - 1

        nodes.append({
            "path": str(rel),
            "title": fm.get("title", ""),
            "summary": fm.get("summary", ""),
            "topics": fm.get("topics") or [],
            "keywords": fm.get("keywords") or [],
            "url": fm.get("url", ""),
            "section": section,
            "depth": depth,
        })
        print(f"  collected: {rel}")

    if dry_run:
        print(f"[dry-run] Would populate graph with {len(nodes)} nodes at {_graph_dir}")
        return

    populate(nodes, _graph_dir)
    print(f"Graph populated: {len(nodes)} nodes at {_graph_dir}")
```

- [ ] **Step 4: Update `main()` to add `--phase3-only` flag**

In `main()`, add the new argument after the existing ones:

```python
parser.add_argument(
    "--phase3-only", action="store_true", help="Run graph population only"
)
```

Replace the mutual-exclusion check block:

```python
exclusive = sum([args.phase1_only, args.phase2_only, getattr(args, "phase3_only", False)])
if exclusive > 1:
    print(
        "Error: --phase1-only, --phase2-only, and --phase3-only are mutually exclusive",
        file=sys.stderr,
    )
    sys.exit(1)
```

Replace the flag derivation logic at the bottom of `main()`:

```python
run_phase1_flag = not args.phase2_only and not args.phase3_only
run_phase2_flag = not args.phase1_only and not args.phase3_only
run_phase3_flag = not args.phase1_only and not args.phase2_only

if run_phase1_flag:
    print("Phase 1: Enriching frontmatter...")
    run_phase1(knowledge_root, dry_run=args.dry_run)

if run_phase2_flag:
    print("\nPhase 2: Generating SUMMARY.MD files...")
    generate_all_summaries(knowledge_root, dry_run=args.dry_run)

if run_phase3_flag:
    print("\nPhase 3: Populating knowledge graph...")
    run_phase3(knowledge_root, dry_run=args.dry_run)
```

- [ ] **Step 5: Run Phase 3 tests**

```bash
uv run pytest tests/test_enrich_knowledge.py -k "phase3" -v
```

Expected: all PASS

- [ ] **Step 6: Run full test suite to check no regressions**

```bash
uv run pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add enrich_knowledge.py tests/test_enrich_knowledge.py
git commit -m "feat: add Phase 3 knowledge graph population to enrich_knowledge pipeline"
```

---

### Task 5: Extend `knowledge.py` with `search_knowledge_graph` tool

**Files:**
- Modify: `knowledge.py`
- Modify: `tests/test_knowledge.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_knowledge.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

```bash
uv run pytest tests/test_knowledge.py -k "search_knowledge_graph" -v
```

Expected: `ImportError` or assertion errors

- [ ] **Step 3: Update `knowledge.py`**

At the top of `knowledge.py`, add a direct import (no circular import — `knowledge_graph.py` does not import from `knowledge.py`):

```python
from knowledge_graph import KnowledgeGraph
```

Add the new tool definition (after the existing `KNOWLEDGE_TOOLS` list definition):

```python
_SEARCH_TOOL: dict = {
    "name": "search_knowledge_graph",
    "description": (
        "Search the knowledge graph for pages relevant to a query. "
        "Returns the top 5 most relevant pages with path, title, and summary. "
        "Use this as your primary navigation method instead of reading SUMMARY.MD files. "
        "Provide a section when the topic domain is clear to scope the search."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Natural language query describing what you are looking for",
            },
            "section": {
                "type": "string",
                "description": "Scope search to a top-level section. Omit to search globally.",
                "enum": [
                    "business",
                    "health",
                    "health-insurance",
                    "health-providers",
                    "help-and-support",
                    "insurance",
                    "investments",
                    "retirement",
                    "risksolutions",
                    "services",
                ],
            },
        },
        "required": ["query"],
    },
}

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
    },
    _SEARCH_TOOL,
]
```

Replace `handle_knowledge_tool` with:

```python
def handle_knowledge_tool(
    name: str,
    inp: dict,
    source_registry: dict,
    knowledge_root: Path = KNOWLEDGE_ROOT,
    knowledge_graph: "KnowledgeGraph | None" = None,
) -> str:
    """Dispatch knowledge tool calls."""
    if name == "read_knowledge":
        return read_knowledge(inp, source_registry, knowledge_root)
    if name == "search_knowledge_graph":
        import json
        if knowledge_graph is None or not knowledge_graph.available:
            return json.dumps([])
        results = knowledge_graph.search(
            inp.get("query", ""),
            section=inp.get("section"),
        )
        return json.dumps(results, indent=2)
    return f"Error: unknown knowledge tool '{name}'"
```

- [ ] **Step 4: Run all knowledge tests**

```bash
uv run pytest tests/test_knowledge.py -v
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add knowledge.py tests/test_knowledge.py
git commit -m "feat: add search_knowledge_graph tool to knowledge module"
```

---

### Task 6: Update `agent.py`

**Files:**
- Modify: `agent.py`

- [ ] **Step 1: Import `KnowledgeGraph` at the top of `agent.py`**

Add after the existing knowledge import:

```python
from knowledge_graph import KnowledgeGraph
```

- [ ] **Step 2: Instantiate `KnowledgeGraph` in `run_agent()`**

Add after `source_registry = build_source_registry(...)`:

```python
knowledge_graph = KnowledgeGraph()
if not knowledge_graph.available:
    print(
        "Warning: knowledge graph not available — "
        "run: uv run python enrich_knowledge.py"
    )
```

- [ ] **Step 3: Thread `knowledge_graph` through the tool handler**

Replace the existing `elif tool_name == "read_knowledge":` block:

```python
elif tool_name in {t["name"] for t in KNOWLEDGE_TOOLS}:
    result = handle_knowledge_tool(
        tool_name, tool_input, source_registry, knowledge_graph=knowledge_graph
    )
```

- [ ] **Step 4: Update the system prompt**

Replace the knowledge base navigation paragraph in `system_prompt`:

```python
system_prompt = f"""You are a capable AI agent with access to a skill library and a knowledge base.

Skills are organised as markdown files in a filesystem. You must:
1. Call `list_skills` to discover available skills.
2. Call `read_skill` for any skill that looks relevant — read it fully before using it.
3. Follow the instructions in the skill file precisely.
4. Only read a skill if it's actually needed for the task.

You also have access to a knowledge base about Aviva's products and services.
Use `search_knowledge_graph` as your primary navigation method:
  1. Call `search_knowledge_graph` with the user's query and a `section` if the domain is clear.
  2. Review the returned titles and summaries to identify the 1–2 most relevant pages.
  3. Call `read_knowledge` on those paths to retrieve full content.
Only fall back to SUMMARY.MD navigation via `read_knowledge` if the graph returns no results.

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

- [ ] **Step 5: Smoke-test the agent with a knowledge query**

```bash
uv run python agent.py "What home insurance products does Aviva offer?"
```

Expected: agent calls `search_knowledge_graph` first (visible in verbose output), then `read_knowledge` on 1–2 paths, then returns a sourced answer. No `SUMMARY.MD` reads should appear.

- [ ] **Step 6: Run full test suite**

```bash
uv run pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add agent.py
git commit -m "feat: wire KnowledgeGraph into agent loop and update system prompt"
```

---

### Task 7: Create `KNOWLEDGE-GRAPH` skill

**Files:**
- Create: `skills/KNOWLEDGE-GRAPH/SKILL.md`

- [ ] **Step 1: Create the skill directory and file**

```bash
mkdir -p skills/KNOWLEDGE-GRAPH
```

Create `skills/KNOWLEDGE-GRAPH/SKILL.md`:

```markdown
---
name: knowledge-graph
description: "Navigate the knowledge base using the knowledge graph. Use when answering questions about Aviva products and services to find the right page faster."
---

# Knowledge Graph Navigation

Use this skill when you need to find information in the Aviva knowledge base. It replaces manual SUMMARY.MD traversal with a single search call.

## When to use

Always use `search_knowledge_graph` before reading any SUMMARY.MD. Only fall back to SUMMARY.MD navigation if `search_knowledge_graph` returns an empty list (`[]`).

## How to search

1. Identify the section from the user's question (see table below).
2. Call `search_knowledge_graph` with the user's question as the query:

```json
{"query": "what does home insurance cover", "section": "insurance"}
```

3. Read the returned titles and summaries. Pick the 1–2 paths that best match.
4. Call `read_knowledge` on each selected path.

If the domain is unclear across multiple sections, omit `section` to search globally:

```json
{"query": "Aviva pension options for employers"}
```

## Section reference

| Section | Covers |
|---------|--------|
| `business` | Employer products, workplace pensions, group protection, defined benefit |
| `health` | Health insurance, health cash plans, medical cover |
| `health-insurance` | Personal health insurance products |
| `health-providers` | GP services, healthcare provider information |
| `insurance` | Home, car, travel, life insurance |
| `investments` | ISAs, funds, investment bonds |
| `retirement` | Personal pensions, annuities, income drawdown |
| `risksolutions` | Risk and protection products |
| `services` | General Aviva services |
| `help-and-support` | Help articles, FAQs, contact information |

## Interpreting results

Each result has `path`, `title`, and `summary`. Use the summary to judge relevance — if it clearly describes what the user is asking about, read that `index.md`. If 2+ results look equally relevant, read both.

## Fallback

If `search_knowledge_graph` returns `[]`, the graph is not populated. Fall back to:
1. `read_knowledge` with `SUMMARY.MD` to explore sections
2. Navigate down using section-level SUMMARY.MD files
```

- [ ] **Step 2: Verify the skill is discoverable**

```bash
uv run python -c "
from skills import build_skill_registry
from pathlib import Path
reg = build_skill_registry(Path('./skills'))
print(reg.get('KNOWLEDGE-GRAPH', 'NOT FOUND'))
"
```

Expected: dict with `path` and `description` keys, description matching the frontmatter.

- [ ] **Step 3: Commit**

```bash
git add skills/KNOWLEDGE-GRAPH/SKILL.md
git commit -m "feat: add KNOWLEDGE-GRAPH skill for agent navigation"
```

---

### Task 8: Populate the graph and run end-to-end

**Files:** none (operational)

- [ ] **Step 1: Run the full enrichment pipeline including Phase 3**

```bash
uv run python enrich_knowledge.py
```

Expected output includes:
```
Phase 3: Populating knowledge graph...
  collected: business/index.md
  ...
Graph populated: NNN nodes at .../knowledge_graph
```

- [ ] **Step 2: Verify graph was created**

```bash
uv run python -c "
from knowledge_graph import KnowledgeGraph
kg = KnowledgeGraph()
print(f'Available: {kg.available}')
results = kg.search('home insurance', section='insurance')
for r in results:
    print(r['path'], '—', r['title'])
"
```

Expected: `Available: True` followed by ranked insurance paths.

- [ ] **Step 3: Run full test suite one final time**

```bash
uv run pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete knowledge graph integration — Kuzu + BM25 search"
```
