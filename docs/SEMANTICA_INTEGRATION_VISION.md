# Semantica × Skilled Agent — Enterprise Knowledge, Context & Semantic Layer

**Status:** Ideation / vision
**Date:** 2026-09-12
**Scope:** How to integrate the [semantica](https://github.com/semantica-agi/semantica)
framework with skilled-agent's hierarchical Markdown knowledge base to produce an
enterprise-grade knowledge management, context, and semantic-layer solution that
serves **both curated Markdown and dense heterogeneous data** (PDFs, charts,
databases) through one agent.

> This is a vision document. It commits to no code. A companion technical design
> lives at `docs/superpowers/specs/2026-09-12-semantica-integration-design.md`,
> and the architecture is illustrated in the accompanying diagram artifact.

---

## 1. The two halves and why they fit

skilled-agent and semantica sit at opposite ends of the same knowledge spectrum
and are almost perfect complements.

| | **skilled-agent (today)** | **semantica** |
|---|---|---|
| Data shape | Curated **Markdown** — hierarchical `index.md`, YAML frontmatter (`title/summary/topics/keywords/url`), `SUMMARY.MD` navigation, README source registry | **Dense / heterogeneous** — files, web, DBs, streams, Databricks/Snowflake/SAP, email, Git |
| "Graph" | Shallow, path-derived: Kuzu LPG, `Page` nodes, `CHILD_OF` edges from directory structure, BM25 over enriched pages | Rich **Context Graph** — typed entities/relations, RDF **and** LPG, ontology (OWL/SHACL/SKOS), bi-temporal facts |
| Reasoning | LLM (DSPy ReAct) + BM25 retrieval | LLM **plus deterministic** — Datalog, SPARQL, Rete, forward chaining, all explainable |
| Provenance | Citations + README URL registry (informal) | W3C **PROV-O** lineage on every fact |
| Human role | Authoring & governance are first-class | Extraction & inference are first-class |
| Experience | Agent + chat + knowledge browser UI + skills + MCP-able | Headless semantic infra + REST + MCP + connectors |

**Thesis.** skilled-agent is a *human-authored, human-readable, governed context
spine* with a great agentic UX but a thin semantic layer. semantica is a
*machine-scale semantic substrate* with deep structure, reasoning, and provenance
but no editorial surface. Combined, curated narrative and dense structured data
live in **one queryable, auditable knowledge fabric**, and the Markdown becomes a
governed *view* of the graph rather than a silo beside it.

---

## 2. The core mental model: two planes, one fabric

Rather than "Markdown store + graph store side by side," frame the system as **one
Context Graph with two synchronized planes**:

- **Editorial plane (Markdown):** what humans write, review, and are accountable
  for. Curated, narrative, versioned in Git, diff-able, governed by PR.
- **Semantic plane (Context Graph):** what machines query and reason over.
  Entities, relations, bi-temporal facts, ontology, provenance.

Every Markdown page **projects into** the graph (its headings, frontmatter, links,
and prose become nodes/facts); slices of the graph **project back out as** Markdown
"knowledge pages." semantica's conflict-detection, dedup, and provenance keep the
two coherent. Markdown stops being a data island and becomes the *editable,
auditable projection* of a formal knowledge layer.

This upgrades three primitives skilled-agent already has:

1. **`CHILD_OF` path hierarchy → real taxonomy.** The directory tree is an implicit
   ontology. Promote it to `skos:broader/narrower` concepts so "the shape of the
   knowledge base" becomes a first-class, queryable ontology.
2. **README source registry → PROV-O provenance.** The existing `path → {url,
   title}` map is provenance in embryo. Feed it into `semantica.provenance` so
   every derived fact traces to its Markdown page *and* the upstream source URL.
3. **Agent citations → decision nodes.** The DSPy agent already emits `citation`
   events. Route them through `semantica.record_decision()` so every answer becomes
   an auditable decision with causal linkage and point-in-time context.

---

## 3. Layered architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  EXPERIENCE      DSPy ReAct agent · Chat/SSE · Knowledge browser       │
│                  + Graph explorer + Decision timeline · MCP endpoint   │
├──────────────────────────────────────────────────────────────────────┤
│  RETRIEVAL &     GraphRAG · hybrid (BM25 + vector) · deterministic     │
│  REASONING       reasoning (Datalog/SPARQL/Rete) · temporal queries    │
├──────────────────────────────────────────────────────────────────────┤
│  UNIFIED         Context Graph (RDF + LPG) · Ontology (OWL/SHACL/SKOS) │
│  SEMANTIC LAYER  Bi-temporal facts · Provenance · Decisions · Conflicts│
├──────────────────────────────────────────────────────────────────────┤
│  INGEST &        semantica pipeline: parse→normalize→split→extract     │
│  EXTRACTION      →conflict→dedup   (Markdown AND dense sources)         │
├──────────────────────────────────────────────────────────────────────┤
│  SOURCES         Markdown repos (Git) │ Databricks·Snowflake·SAP·DBs·  │
│                  (editorial plane)     │ streams·email·PDFs (dense)     │
└──────────────────────────────────────────────────────────────────────┘
        ▲ humans author/curate here          ▲ machines ingest here
        └──────────── bidirectional projection + provenance ────────────┘
```

The key move at the **Unified Semantic Layer**: today `knowledge_graph.py` uses
Kuzu + BM25. Wrap that interface (`search()`, `available`, node dicts) around
semantica's polyglot store so the rest of skilled-agent is unaware the backend is
now RDF/LPG with a full ontology. **semantica becomes the graph backend;
skilled-agent becomes semantica's editorial + agent front-end.**

---

## 4. The bidirectional loop — how "both Markdown and dense data" works

**Upward (Markdown → graph): curation becomes structure.**
- Replace the LLM-frontmatter `enrich_knowledge.py` step with
  `semantica.semantic_extract`: NER + relation extraction + triplet generation
  turns prose into entities and facts.
- Use `semantica.split` (entity-/relation-/ontology-aware chunking) instead of
  page-level indexing, so retrieval preserves relationship triplets, not just
  text similarity.
- Frontmatter `topics`/`keywords` seed the ontology's controlled vocabulary (SKOS),
  so human tagging steers machine extraction rather than competing with it.

**Downward (dense data → Markdown): structure becomes readable, governed knowledge.**
- A slice of the Context Graph (e.g., "everything about Product X, valid as of Q3")
  is materialized as a Markdown page — *living documentation* always consistent with
  the underlying data — and drops into the existing KB and browser UI.
- Humans annotate/override those pages; overrides flow back as high-credibility facts.

**Source-of-truth policy (recommendation).** Do **not** pick a single global source
of truth. Lean on semantica's per-fact **provenance + credibility scores + conflict
records** so precedence is a *policy*, not a hardcode: human-curated facts get higher
default credibility in regulated/narrative domains; fresh dense-data facts win for
fast-moving operational data. Conflicts surface in a UI inbox for human adjudication
rather than being silently merged.

---

## 5. Ingesting dense data (PDFs with charts) efficiently

### 5.1 The governing principle: ingest-time cost vs. query-time cost

The reason sparse Markdown is "readable on the fly" is not that it is Markdown — it
is that it is *already small and agent-legible*, so query-time work is near zero. A
dense 300-page PDF is the opposite: reading it per-query is fatal to latency and
cost. Therefore the governing principle for the whole system is:

> **Push expensive work to ingestion time so query time stays cheap.**

Everything — Markdown, PDF, or Snowflake table — gets a *retrieval representation*
built once at ingest (chunks, embeddings, extracted facts, summaries). At query
time the agent only ever touches small, pre-digested artifacts. "Reading Markdown
on the fly" is just the degenerate case where ingestion had little to do.

### 5.2 Exploding a dense PDF into typed artifacts

A dense PDF is not one thing. At ingest it is exploded into several cheap-to-retrieve
artifacts:

1. **Layout-aware parse**, not naïve text extraction — preserve reading order,
   headings, tables, figure regions. (`semantica.ingest`/`parse`; hard PDFs need
   real investment — see §8.)
2. **Tables → structured facts** in the Context Graph (typed entities + values +
   ontology concept). "Q3 revenue = £4.2m" becomes a queryable, citable *fact*, not
   pixels.
3. **Charts/figures → three artifacts:** (a) the image blob in object storage,
   referenced; (b) where recoverable, an extracted data table as graph facts; (c) a
   **vision-model caption** generated at ingest and embedded like any other chunk.
4. **Prose → entity-aware chunks + embeddings** via `semantica.split`, so each chunk
   carries its relationship triplets and ontology concepts (GraphRAG, not flat RAG).
5. **Multi-resolution summaries** — doc-level, per-section, and chunk-level detail.
6. **Provenance on everything** — every chunk/fact/caption points back to *doc, page,
   bounding box* via PROV-O, so citations resolve to the exact page.

### 5.3 Dense docs become "Markdown-shaped" summary trees

Step 5 projects a dense PDF into the same hierarchical summary structure the Markdown
KB already uses (`index.md → sections → detail` ≈ `doc-summary → section-summaries →
chunks`). The agent reads the **summaries** on the fly — cheap, like sparse Markdown —
and drills into detail chunks only when a query demands it. **That is the answer to
"dense docs aren't efficient to read on the fly": you don't read them; you read their
projection, and drill into detail on demand.**

---

## 6. Retrieval & how the agent combines any source type

### 6.1 Do we need a vector database? Yes — but not a bolt-on

skilled-agent's current Kuzu + BM25 is **not** sufficient for dense semantic
retrieval — BM25 is lexical and misses conceptual matches. Dense vector retrieval is
required. But **semantica already ships `semantica.vector_store` with hybrid search
across FAISS/Qdrant/Weaviate/Milvus/Pinecone/PgVector**, so the vector DB is a
*required component*, not a *net-new build* — pick a backend behind semantica's
abstraction.

- **Recommended default:** **pgvector** (one boring, on-prem-friendly Postgres) for
  regulated deployments and modest scale; **Qdrant** for large corpora needing
  purpose-built ANN.
- **Keep BM25** as one leg of hybrid retrieval — it beats vectors for codes, IDs, and
  proper nouns.

What is genuinely net-new (the real work) vs. provided:

| Component | Needed? | Build or provided |
|---|---|---|
| Vector index + hybrid search | Yes | **Provided** by semantica — choose a backend |
| Embedding model | Yes | Choice/config (absent from today's BM25-only path) |
| Graph store + ontology + provenance + temporal | Yes | **Provided** by semantica |
| Layout-aware PDF parsing / OCR | Yes | Partly semantica; hard PDFs need investment |
| Chart/figure understanding (VLM captioning, table extraction) | Yes | **Mostly net-new** — a vision step wired into ingest |
| Object storage for originals + chart images | Yes | Trivial (S3/MinIO) |

**Bottom line:** you do **not** stand up a parallel RAG stack — semantica's vector
store + GraphRAG cover the retrieval architecture. The one place you spend genuine
effort is **multimodal document ingestion**, which is the hard part of *any*
enterprise KM system, not a gap in this design.

### 6.2 Three retrieval modes, one ranking

1. **Vector/dense** — semantic similarity over chunks (finds relevant passages,
   including chart captions).
2. **Lexical/BM25** — exact terms, codes, names.
3. **Graph traversal (GraphRAG)** — from a retrieved entity, hop to connected facts.
   This is what pure vector RAG lacks and is the whole point of the semantic layer.

### 6.3 The agent never sees file formats — it sees evidence units

Ingestion normalizes everything into **evidence units**: `{content, type,
provenance, score}` where `type ∈ {markdown_chunk, pdf_chunk, chart_caption, fact,
table_row, db_value, decision}`. Because all share one ontology and one provenance
model, they are interchangeable inputs to synthesis. The DSPy ReAct agent gets a
small uniform tool surface (detailed in the design spec):

- `semantic_search(query)` → hybrid vector+BM25 over all chunks/captions regardless
  of origin.
- `graph_query(entity | pattern)` → traverse the KG to gather connected facts
  (GraphRAG expansion).
- `read_knowledge_file(path)` / `get_chunk(ref)` → fetch full content only when cheap
  and worth reading wholesale, or when detail is genuinely needed.
- `reasoning(...)` → deterministic answer where a rule governs.

A single response then weaves a curated Markdown policy statement + a figure
extracted from a PDF chart + a live Snowflake number, **each independently cited via
provenance**. The agent loop becomes *retrieve → graph-expand → selectively read →
synthesize with citations*; the shared ontology makes cross-source fusion coherent.

### 6.4 Keeping it timely

1. **Tiered/multi-resolution retrieval** — start coarse (which docs/sections),
   drill into chunk-level detail only for the few chunks a query needs.
2. **Facts beat text** — retrieve the extracted fact (a few tokens) instead of
   re-parsing the source (a megabyte).
3. **Prompt caching for the stable core** — cache the ontology and hot Markdown pages
   across queries.

---

## 7. What makes it enterprise-grade

- **Auditability & explainability.** Every answer → a decision node with a causal
  chain back through facts, pages, and source systems (PROV-O). Answer *"why did the
  assistant tell a customer X, and what did we know when?"*
- **Point-in-time truth (bi-temporal).** Valid-time vs. recorded-time separation
  makes historical replay and compliance defensible.
- **Deterministic guardrails over an LLM.** SHACL + Datalog/SPARQL rules enforce
  policy *before* the agent answers; the LLM proposes, deterministic reasoning and
  `check_decision_rules()` dispose.
- **One context layer, many consumers.** Expose the fabric over MCP so Claude Code,
  Cursor, other agents, and the chat UI read/write the *same* governed layer.
- **Vendor-neutral, self-hostable.** A real selling point for regulated on-prem
  deployments vs. closed enterprise KM suites.

---

## 8. Candid caveat

The semantic layer, GraphRAG, and vector store are the *solved* part — semantica
provides most of it. The majority of real engineering, and where to temper
expectations, is **robust multimodal PDF ingestion**: scanned documents, messy
layouts, and charts whose underlying data is not cleanly recoverable. No semantic
layer makes that free. De-risk by piloting on **one document class from one org
area**, measuring end-to-end extraction quality, and only then generalizing.

---

## 9. Product shape

A **"Context & Semantic Layer" platform** with three faces:

1. **Knowledge Workbench (humans)** — today's Markdown browser + chat, plus a graph
   explorer, a conflict inbox for adjudication, and a decision/provenance timeline.
2. **Agent Runtime (automation)** — the DSPy agent + skills, now with semantica
   reasoning/decision/graph tools alongside Markdown navigation.
3. **Semantic API / MCP endpoint (integration)** — headless access for other apps and
   agents; connectors on one side, REST/MCP on the other.

**Personas:** knowledge engineers curate the Markdown spine and ontology;
analysts/agents query across Markdown + dense data; compliance/audit consume the
decision + provenance trail; downstream agents consume the MCP layer.

---

## 10. Phasing

- **Phase 0 — Spike:** point `knowledge_graph.py` at semantica as a drop-in graph
  backend behind the existing `search()` interface; prove the current app works
  unchanged.
- **Phase 1 — Enrich upward:** replace `enrich_knowledge.py` with semantica
  extraction + ontology-aware split; promote `CHILD_OF` to SKOS and the README
  registry to PROV-O.
- **Phase 2 — Dense sources + downward projection:** add one enterprise connector and
  one PDF document class; generate Markdown pages from graph slices.
- **Phase 3 — Reasoning & decisions:** wire agent citations to `record_decision()`,
  add SHACL/Datalog guardrails, surface the conflict inbox and decision timeline.
- **Phase 4 — Federate:** expose the fabric over MCP for other agents/tools.

---

## 11. Open questions for decision

1. **Source-of-truth policy** — primarily curated-knowledge (Markdown-authoritative)
   or data-intelligence (dense-data-authoritative)? Shifts default credibility.
2. **Ontology strategy** — grow organically from folders + frontmatter, or start from
   a domain standard (e.g., FIBO for the current finance/insurance content)?
3. **Storage backend** — RDF triple store vs. LPG (Neo4j/Kuzu) given deployment and
   regulatory constraints?
4. **Deployment posture** — fully self-hosted/on-prem (regulated) or cloud-managed?
