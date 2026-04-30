# Knowledge Graph Design

**Date:** 2026-04-30  
**Branch:** feature/knowledge-graph  
**Status:** Approved

## Overview

Introduce a knowledge graph to replace sequential `SUMMARY.MD` navigation with a single `search_knowledge_graph` tool call. The agent currently spends 3–5 tool calls traversing SUMMARY.MD files level by level to locate a relevant `index.md`. The graph collapses this to 1 search call + 1–2 targeted `read_knowledge` calls.

## Technology

**Kuzu** — embeddable graph database (no server, single directory on disk, like SQLite for graphs). Full native Cypher support. Python package (`kuzu`). Stored at `./knowledge_graph/`.

**rank-bm25** — pure Python BM25 implementation for flexible text matching. Built in-memory at startup from graph data (~412 nodes, sub-second). Handles keyword variation and partial term overlap without LLM calls or a vector store.

NebulaGraph was considered but rejected: it requires a running distributed server, which is disproportionate overhead for a local knowledge index.

## Graph Schema

### Node type: `Page`

| Property  | Type       | Description                                      |
|-----------|------------|--------------------------------------------------|
| `path`    | STRING (PK)| Relative path from knowledge root (e.g. `business/defined-benefit-solutions/index.md`) |
| `title`   | STRING     | Page title from frontmatter                      |
| `summary` | STRING     | 1–2 sentence summary from frontmatter            |
| `topics`  | STRING[]   | Topics list from frontmatter                     |
| `keywords`| STRING[]   | Keywords list from frontmatter                   |
| `url`     | STRING     | Source URL from frontmatter                      |
| `section` | STRING     | Top-level directory name (e.g. `business`)       |
| `depth`   | INT64      | Directory depth from knowledge root              |

### Relationship: `CHILD_OF`

`(Page)-[:CHILD_OF]->(Page)` — child node to its parent directory node. Resolved by splitting each file's path and matching to parent.

Both `index.md` leaf pages and intermediate directory nodes (represented by their directory path, e.g. `business/`) are `Page` nodes. Sections are not a separate node type — they are `Page` nodes at depth 1.

## Enrichment Pipeline — Phase 3

Added to `enrich_knowledge.py` after existing Phase 1 (frontmatter) and Phase 2 (SUMMARY.MD generation).

**Behaviour:**
- Walks all `index.md` files under the knowledge root
- Reads enriched frontmatter (requires Phase 1 to have run first)
- Upserts each node using Cypher `MERGE` on `path` — idempotent, safe to re-run
- Creates `CHILD_OF` edges by resolving each file's parent path
- Runs by default alongside Phase 1 and 2; skipped automatically when `--phase1-only` or `--phase2-only` is passed (consistent with existing pattern)
- Can be run in isolation with `--phase3-only`

**CLI flag added:**
```
--phase3-only   Run graph population only (skip phases 1 and 2)
```

## BM25 Index

Built in-memory at agent startup by loading all `Page` nodes from Kuzu.

**Document format per node:**
```
{title} {summary} {topics joined by space} {keywords joined by space}
```

**At query time:**
1. If `section` provided: Kuzu fetches all nodes where `section = $section` (Cypher, fast indexed lookup)
2. BM25 scores `query` against the candidate document set
3. Returns top-5 nodes ranked by score

The BM25 index is rebuilt from the graph on each server start. No separate persistence. With 412 nodes this takes under 100ms.

## `search_knowledge_graph` Tool

### Interface

```json
{
  "name": "search_knowledge_graph",
  "description": "Search the knowledge graph for pages relevant to a query. Returns the top 5 most relevant pages with their path, title, and summary. Use this instead of navigating SUMMARY.MD files. Provide a section to scope the search when the topic domain is clear.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language query describing what you are looking for"
      },
      "section": {
        "type": "string",
        "description": "Scope search to a top-level section. Omit to search globally.",
        "enum": ["business", "health", "health-insurance", "health-providers", "help-and-support", "insurance", "investments", "retirement", "risksolutions", "services"]
      }
    },
    "required": ["query"]
  }
}
```

### Response format

```json
[
  {
    "path": "business/defined-benefit-solutions/index.md",
    "title": "Bulk purchase annuity - Aviva",
    "summary": "Explains Aviva's bulk purchase annuity solutions..."
  },
  ...
]
```

Up to 5 results. If the graph returns no results (graph not populated, or genuinely no matches), the tool returns an empty list and the agent falls back to SUMMARY.MD navigation.

## Agent Integration

### `knowledge.py`

- Add `KnowledgeGraph` class encapsulating Kuzu connection + BM25 index
- `KnowledgeGraph.search(query, section)` implements the two-step flow (Cypher filter → BM25 rank)
- `KnowledgeGraph` initialised once at agent startup, passed alongside `source_registry`
- `handle_knowledge_tool` extended to route `search_knowledge_graph` calls
- `KNOWLEDGE_TOOLS` extended with the new tool definition

### `agent.py`

- `KnowledgeGraph` instantiated in `run_agent()` (gracefully skips if `./knowledge_graph/` does not exist, logs a warning)
- Passed through to `handle_knowledge_tool`

### System prompt update

Add to the knowledge base navigation instructions:

> Use `search_knowledge_graph` as your primary way to find relevant pages — pass the user's query and a `section` if the topic domain is clear. Then call `read_knowledge` on the 1–2 most relevant paths returned. Only fall back to SUMMARY.MD navigation if the graph is unavailable or returns no useful results.

## Skill File

`skills/KNOWLEDGE-GRAPH/SKILL.md` — teaches the agent:

- When to use `search_knowledge_graph` vs SUMMARY.MD navigation
- How to choose the `section` parameter from the user query
- How to interpret the top-5 results and decide which `index.md` to read
- Fallback behaviour when no results are returned

## Dependencies

Two new packages added to `pyproject.toml`:

```
kuzu
rank-bm25
```

## Call Count Comparison

| Scenario | Today | With graph |
|----------|-------|------------|
| Narrow query, clear domain | 4–5 calls | 2 calls |
| Broad query, global search | 5–7 calls | 2–3 calls |
| Graph unavailable (fallback) | — | same as today |

## Out of Scope

- Vector/semantic search (synonym handling): not included; BM25 over LLM-generated keywords is sufficient for this use case
- Graph visualisation or external graph query interface
- Incremental graph updates on file change (full re-run of Phase 3 is fast enough)
