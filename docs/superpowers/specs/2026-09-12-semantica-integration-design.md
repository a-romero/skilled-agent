# Design: Semantica Integration — Evidence-Unit Model, Retrieval Backend & Agent Tool Surface

**Status:** Design (feasibility-oriented)
**Date:** 2026-09-12
**Related:** `docs/SEMANTICA_INTEGRATION_VISION.md`

This spec pins the vision to skilled-agent's actual interfaces so it is
implementable and testable. It covers three things the vision left abstract:

1. The **evidence-unit** interface every retrieval result conforms to.
2. How semantica **replaces the retrieval backend** behind the existing
   `KnowledgeGraph` contract without breaking callers.
3. The concrete **agent tool surface** and the ingestion pipeline stages.

Design goal: **additive, backward-compatible**. `KnowledgeGraph.search()`,
`read_knowledge_tool`, the DSPy `KnowledgeAgentSignature`, and the SSE event
protocol keep working; new capability is layered behind the same shapes.

---

## 1. Current interfaces (the contract we must preserve)

From `backend/knowledge/knowledge_graph.py`:

```python
class KnowledgeGraph:
    @property
    def available(self) -> bool: ...
    def search(self, query: str, section: str | None = None,
               top_k: int = 5) -> list[dict]:
        # each result: {"path": str, "title": str, "summary": str}
```

From `backend/dspy_agent.py`, the ReAct tool surface:

- `search_knowledge_graph_tool(query: str, section: str = "") -> str`  (JSON list)
- `read_knowledge_tool(path: str) -> str`
- `list_skills_tool() -> str`, `read_skill_tool(skill_name: str) -> str`

SSE / `event_callback` protocol (frontend depends on these `kind`s):

```
{"kind": "read",   "path": ...}
{"kind": "search", "query": ..., "section": ...}
{"kind": "skill_list"}
{"kind": "skill_read", "name": ..., "desc": ...}
{"kind": "think",  "text": ...}
```

**Constraint:** any new backend must keep `search()` returning `{path, title,
summary}` dicts and keep the existing event `kind`s valid. New event kinds are
additive.

---

## 2. The evidence unit

The single normalized shape every retrieval mode returns. It generalizes today's
`{path, title, summary}` result — those three keys remain present so existing
callers and the frontend keep working.

```python
from dataclasses import dataclass, field
from typing import Literal, Any

EvidenceType = Literal[
    "markdown_chunk",   # a chunk of a curated Markdown page
    "pdf_chunk",        # a chunk of prose from a dense document
    "chart_caption",    # VLM-generated description of a figure/chart
    "fact",             # a triplet/fact from the Context Graph
    "table_row",        # an extracted structured row
    "db_value",         # a live value fetched from a connector
    "decision",         # a recorded prior decision (semantica)
]

@dataclass
class Provenance:
    source_id: str                 # doc/page id or connector URI
    source_url: str | None = None  # from README registry / connector
    locator: str | None = None     # e.g. "page=12;bbox=..." or "path#section"
    valid_time: str | None = None  # bi-temporal: when true in the world
    recorded_time: str | None = None  # when learned
    prov_o: dict[str, Any] = field(default_factory=dict)  # W3C PROV-O payload
    credibility: float | None = None  # source credibility score

@dataclass
class EvidenceUnit:
    # --- backward-compatible trio (kept for existing callers/UI) ---
    path: str                      # canonical locator; a KB path for markdown
    title: str
    summary: str
    # --- new fields (ignored by legacy consumers) ---
    id: str = ""
    type: EvidenceType = "markdown_chunk"
    content: str = ""              # the retrievable payload (chunk/caption/fact text)
    score: float = 0.0
    provenance: Provenance | None = None
    entities: list[str] = field(default_factory=list)  # linked graph node ids
    embedding_ref: str | None = None

    def to_legacy(self) -> dict:
        return {"path": self.path, "title": self.title, "summary": self.summary}
```

`KnowledgeGraph.search()` continues to return `list[dict]` via
`[u.to_legacy() for u in units]`. A new `search_evidence()` returns the full
`list[EvidenceUnit]` for callers that want the richer shape.

---

## 3. Backend replacement strategy (Phase 0 → 1)

Introduce a `RetrievalBackend` protocol and make `KnowledgeGraph` a thin adapter,
so Kuzu/BM25 and semantica are swappable via config.

```python
from typing import Protocol

class RetrievalBackend(Protocol):
    @property
    def available(self) -> bool: ...
    def search_evidence(self, query: str, *, section: str | None = None,
                        top_k: int = 5, modes: tuple[str, ...] = ("vector","bm25","graph"),
                        ) -> list[EvidenceUnit]: ...
    def graph_query(self, seed: str, *, hops: int = 1,
                   rel_types: list[str] | None = None) -> list[EvidenceUnit]: ...

class KuzuBM25Backend:   # today's implementation, wrapped
    ...

class SemanticaBackend:  # new: semantica.vector_store + kg + reasoning
    ...
```

```python
# knowledge_graph.py
class KnowledgeGraph:
    def __init__(self, graph_dir=GRAPH_ROOT, backend: RetrievalBackend | None = None):
        self._backend = backend or _backend_from_env()  # env: RETRIEVAL_BACKEND=kuzu|semantica

    @property
    def available(self) -> bool:
        return self._backend.available

    def search(self, query, section=None, top_k=5) -> list[dict]:
        units = self._backend.search_evidence(query, section=section, top_k=top_k)
        return [u.to_legacy() for u in units]        # unchanged contract

    def search_evidence(self, query, section=None, top_k=5) -> list[EvidenceUnit]:
        return self._backend.search_evidence(query, section=section, top_k=top_k)
```

**Phase 0 acceptance test:** with `RETRIEVAL_BACKEND=semantica`, the existing
integration suite passes unchanged (same `{path,title,summary}` behavior), proving
the swap is transparent. `RETRIEVAL_BACKEND=kuzu` remains the default until parity
is shown.

### Section mapping

Today `section` is a top-level KB folder. In semantica it maps to a SKOS concept /
graph subgraph filter. `SemanticaBackend.search_evidence(section=...)` translates
the section string to an ontology-scoped query; the string values callers pass stay
identical.

---

## 4. Ingestion pipeline (dense sources)

A declarative `semantica.pipeline` per source class. Markdown keeps a lightweight
path; dense docs get the full multimodal path.

```
Markdown source:
  parse frontmatter → extract(NER, relations, triplets) → split(ontology-aware)
  → embed → upsert{graph nodes, chunks, provenance from README registry}

Dense PDF source:
  ingest(file) → layout-parse ──┬─ prose  → split(entity-aware) → embed → chunks
                                ├─ tables → extract rows        → facts (graph)
                                └─ figures→ VLM caption + image blob (object store)
                                            → embed caption → chart_caption chunk
  → normalize → conflict-detect → dedup → upsert{graph, chunks, PROV-O(page,bbox)}
  → summarize(doc / section / chunk)  # multi-resolution tree
```

Each stage is an independently importable semantica module (`ingest`, `parse`,
`normalize`, `split`, `semantic_extract`, `conflicts`, `deduplication`, `kg`,
`provenance`). The **VLM captioning + table extraction for figures is the net-new
component** wired in at the figure branch.

**Multi-resolution output** mirrors the Markdown KB shape so the downward projection
(§Vision 4) and tiered retrieval (§Vision 6.4) work uniformly:

```
doc:{id}                      # doc-level summary node  (like index.md)
  section:{id}#{n}            # section summary nodes    (like SUMMARY.MD entries)
    chunk:{id}#{n}#{m}        # detail chunks            (leaf content)
```

---

## 5. Agent tool surface (DSPy ReAct)

Extend the tool list in `run_agent()` (`backend/dspy_agent.py`). Existing tools stay;
new ones are added. All fire `event_callback` so the SSE UI can render them.

| Tool | Signature | Backed by | Event kind |
|---|---|---|---|
| `search_knowledge_graph_tool` *(existing, now hybrid)* | `(query, section="") -> str` | `search_evidence` (vector+bm25+graph) | `search` |
| `graph_query_tool` *(new)* | `(entity, hops=1) -> str` | `backend.graph_query` | `graph` |
| `read_knowledge_tool` *(existing)* | `(path) -> str` | Markdown read | `read` |
| `get_chunk_tool` *(new)* | `(ref) -> str` | chunk store fetch | `read` (reuse) |
| `reasoning_tool` *(new, guarded)* | `(query) -> str` | semantica reasoning (SPARQL/Datalog) | `reason` (new) |
| `list_skills_tool` / `read_skill_tool` *(existing)* | — | skills registry | `skill_*` |

The `search_knowledge_graph_tool` **docstring and return shape stay identical**
(JSON list of `{path,title,summary}`), so the agent's existing prompt in
`KnowledgeAgentSignature` keeps working; richer fields ride along for callers that
opt into `search_evidence`. New event kinds (`graph`, `reason`) are additive — the
frontend renders unknown kinds as generic steps until it adds explicit support.

### New event kinds (additive)

```
{"kind": "graph",  "entity": ..., "hops": ...}
{"kind": "reason", "query": ..., "rule": ...}
{"kind": "citation", "path": ..., "title": ..., "url": ..., "prov_id": ...}
```

`citation` extends today's citation event with a `prov_id` linking to the PROV-O
chain / decision node.

### Retrieve → expand → synthesize loop

The ReAct signature guidance gains one step (no breaking change to existing steps):

1. `search_knowledge_graph_tool` → candidate evidence units (any modality).
2. For the 1–2 strongest entity hits, `graph_query_tool` → connected facts (GraphRAG).
3. `read_knowledge_tool` / `get_chunk_tool` only for units worth reading in full.
4. Optionally `reasoning_tool` where a rule governs the answer.
5. Synthesize; cite every unit via its provenance in the `## Sources` section.

---

## 6. Decision & provenance wiring

At answer time, `run_agent()` records the decision so the audit trail closes:

```python
# after result.answer is produced
semantica.record_decision(
    scenario=task,
    reasoning=result.reasoning,          # DSPy trace
    outcome=answer,
    evidence=[u.id for u in used_units], # causal linkage to evidence units
    valid_time=now, recorded_time=now,
)
```

Each `citation` event already emitted by the agent is enriched with the evidence
unit's `provenance.prov_id`. This is what powers "why did the agent answer this, and
what did we know when."

---

## 7. Configuration surface

```
RETRIEVAL_BACKEND = kuzu | semantica          # default kuzu until parity proven
VECTOR_STORE      = pgvector | qdrant | ...    # semantica backend selection
EMBEDDING_MODEL   = <model id>
GRAPH_STORE       = rdf | lpg                  # semantica polyglot store
ENABLE_REASONING  = false | true              # gates reasoning_tool
OBJECT_STORE_URI  = s3://... | file://...     # originals + chart images
```

`_backend_from_env()` reads `RETRIEVAL_BACKEND`; everything else is consumed by the
`SemanticaBackend` constructor and the ingestion pipeline config.

---

## 8. Feasibility notes & risks

- **Transparent swap is the crux of Phase 0.** If `to_legacy()` + section mapping
  reproduce current behavior, the rest is additive and low-risk to the running app.
- **Latency budget.** Query-time cost = one hybrid vector+BM25 lookup + a bounded
  graph hop (`hops<=2`) + reading a few small chunks. No whole-document reads. Cache
  ontology + hot pages.
- **Biggest risk = multimodal PDF quality**, not the semantic layer. Pilot one
  document class; measure extraction precision/recall before generalizing.
- **Reasoning tool is guarded** (`ENABLE_REASONING`) so the deterministic layer can
  be introduced without destabilizing the LLM path.

---

## 9. Test plan (per phase)

- **Phase 0:** existing integration suite green with `RETRIEVAL_BACKEND=semantica`;
  golden-set of queries returns equivalent top-k paths vs. kuzu backend.
- **Phase 1:** extraction produces entities/triplets for a sample KB section; SKOS
  taxonomy round-trips the folder hierarchy; README URLs appear as PROV-O sources.
- **Phase 2:** one PDF class ingested; chart caption + extracted table facts are
  retrievable and cite the correct page; downward-projected Markdown renders in the
  existing browser.
- **Phase 3:** every answer produces a decision node with a traceable evidence chain;
  a SHACL/Datalog guardrail blocks a known policy-violating answer.
