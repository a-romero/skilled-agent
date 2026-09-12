# High-Level Design — Clean Repo Separation: skilled-agent ↔ semantic-fabric

**Status:** High-level design
**Date:** 2026-09-12
**Supersedes** the single-repo "drop-in in-process backend" framing in
`docs/superpowers/specs/2026-09-12-semantica-integration-design.md` wherever they
conflict: the semantica backend is now a **separate service in its own repo**, not
an in-process import. The evidence-unit model and the `RetrievalBackend` contract
from that spec are reused unchanged — they become the *wire* contract.

**Related:** `docs/SEMANTICA_INTEGRATION_VISION.md` (the "why" and the fabric model).

---

## 1. Goal

Keep **skilled-agent** lean and unchanged in spirit — the editorial + agent
front-end — and put **all** semantica-based capability (ingestion, Context Graph,
ontology, vector store, reasoning, provenance, decisions, enterprise connectors)
into a **separate repository** that ships as an independently deployable service.

Hard requirements from the separation:

1. **skilled-agent has zero dependency on `semantica`** — no heavy graph/vector/VLM
   libraries leak into it.
2. **skilled-agent still runs standalone** — with no semantic layer present, it
   falls back to today's Kuzu/BM25 behavior. The layer is an *upgrade*, not a
   prerequisite.
3. **The two repos version and deploy independently**, coupled only by a small,
   stable, versioned contract.

---

## 2. The two repositories

### `skilled-agent` (existing — stays lean)
Owns the **editorial plane** and the experience:
- Markdown knowledge base (Git-versioned), `index.md`/`SUMMARY.MD`, frontmatter.
- DSPy ReAct agent, skills, FastAPI + SSE, React UI.
- Today's Kuzu + BM25 retrieval, kept as the **fallback backend**.

New code added here is minimal and semantica-free:
- A thin **fabric client** (HTTP + MCP) — installed as a lightweight package, no
  heavy deps.
- A `RemoteFabricBackend` implementing the existing `RetrievalBackend` protocol.
- Config to select and locate the fabric.

### `semantic-fabric` (new — owns everything semantica)
Owns the **semantic plane** and all heavy machinery:
- Ingestion pipelines (dense PDFs w/ charts, enterprise connectors, streams).
- Context Graph (RDF + LPG), ontology (OWL/SHACL/SKOS), vector store, reasoning,
  provenance (PROV-O), decisions.
- Object storage for originals + chart images.
- **All enterprise credentials** (Snowflake/SAP/Databricks) live here, never in
  skilled-agent — a security benefit of the split (§7).
- Exposes a **versioned REST + MCP API** and publishes the lightweight client.

```
semantic-fabric/
├── contracts/            # OpenAPI + JSON-Schema for evidence units, requests
├── client/               # published pkg: fabric-client (contracts + HTTP/MCP), minimal deps
├── api/                  # REST + MCP server (the boundary)
├── ingest/               # parse · split · extract · conflict · dedup · connectors
├── retrieval/            # hybrid vector + BM25 + graph expansion
├── graph/                # Context Graph, ontology
├── reasoning/            # SPARQL/Datalog/SHACL
├── provenance/           # PROV-O, decisions
└── deploy/               # docker-compose / helm
```

---

## 3. The boundary (the crux of the separation)

Rejected: **in-process import** of semantic-fabric into skilled-agent — it drags
semantica's graph/vector/VLM dependency tree back in and defeats the separation.

Chosen: **network service boundary — REST + MCP — plus a small shared contract
package.**

```
┌────────────────────────┐        versioned wire contract        ┌──────────────────────────┐
│      skilled-agent      │  ────────  (evidence units) ────────► │      semantic-fabric      │
│                         │                                       │        (service)          │
│  DSPy agent · UI · KB   │   RemoteFabricBackend ──HTTP/MCP──►    │  REST + MCP API           │
│  Kuzu/BM25 (fallback)   │  ◄──────  evidence units  ──────────  │  ingest · graph · reason  │
│                         │                                       │  vector · provenance      │
│  depends on: fabric-    │                                       │  connectors + credentials │
│  client (thin, no       │                                       │                           │
│  semantica)             │                                       │  depends on: semantica    │
└────────────────────────┘                                       └──────────────────────────┘
        depends on ──────────────►  fabric-client / contracts  ◄────────── published by
```

- **`fabric-client`** lives **in the `semantic-fabric` repo** and is published from
  it (`client/`): contract types (the `EvidenceUnit` schema, generated from
  `contracts/`) + an HTTP/MCP client. Tiny dependency surface (`httpx`, `pydantic`),
  no `semantica`. skilled-agent depends on **this package only**. Keeping the client
  in the same repo as the API means the contract and its client version together in
  one CI pipeline — no third repo to keep in sync.
- The wire contract **is** the `RetrievalBackend` protocol from the earlier spec,
  serialized. `search()` still returns `{path, title, summary}` to legacy callers;
  richer evidence units ride the wire for callers that opt in.

### Mapping onto existing skilled-agent code
`KnowledgeGraph` gains one more backend behind the same protocol:

```
RETRIEVAL_BACKEND = kuzu | fabric      # default kuzu (standalone)
FABRIC_URL        = http://semantic-fabric:8080
FABRIC_TOKEN      = <service token>
```

`RemoteFabricBackend.search_evidence()` calls `POST /search`; `graph_query()` calls
`POST /graph/expand`. **If the fabric is unreachable, it degrades to the Kuzu
backend** so the agent never hard-fails on a missing layer.

---

## 4. API surface across the boundary

Small and stable. Everything is also exposed as MCP tools, so skilled-agent's agent
— and any *other* agent/tool — consume the fabric identically.

| Concern | REST | MCP tool | Returns |
|---|---|---|---|
| Hybrid retrieval | `POST /search` | `fabric.search` | evidence units |
| Graph expansion | `POST /graph/expand` | `fabric.graph_query` | evidence units (facts) |
| Fetch detail | `GET /chunk/{ref}` | `fabric.get_chunk` | chunk content |
| Read a KB page | `GET /kb/{namespace}/{path}` | `fabric.read_page` | Markdown (authored or generated) |
| Browse a namespace | `GET /kb/{namespace}/tree` | `fabric.list_kb` | tree of pages |
| Deterministic reasoning | `POST /reason` | `fabric.reason` | answer + rule trace |
| **Push a source to ingest** | `POST /ingest` (async) | `fabric.ingest` | job id |
| Job status | `GET /jobs/{id}` | — | status |
| Record / trace decision | `POST /decisions`, `GET /decisions/{id}/chain` | `fabric.record_decision` | decision + provenance |

**`/ingest` is the push entry point.** Anyone — skilled-agent, a CI job, a human
running a CLI, another service — can push a source (a Markdown tree, a batch of
PDFs, a connector descriptor) to `/ingest` from anywhere. The fabric owns what
happens next; the caller only needs the endpoint and a token. `GET /kb/...` reads
back both KB namespaces (below) as Markdown, so skilled-agent's browser and agent
consume authored and generated pages through one uniform read path.

---

## 5. Data ownership — who stores what

| Data | Owner | Notes |
|---|---|---|
| **Authored KB** (curated Markdown) | its own repo/filesystem *(for now: lives in skilled-agent)* | The human-authored editorial plane. **Pushed to `/ingest`.** |
| **Generated KB** (`generated/` namespace) | **semantic-fabric** | Machine-produced Markdown from the ingestion pipeline (see below). |
| Context Graph, facts, ontology | semantic-fabric | Derived semantic plane. |
| Vector index | semantic-fabric | pgvector / Qdrant behind semantica. |
| Original files + chart images | semantic-fabric | Object store (S3/MinIO). |
| Provenance + decisions | semantic-fabric | PROV-O lineage. |
| Enterprise credentials | semantic-fabric | Never in skilled-agent. |

### Two KB namespaces, one read path

The KB is **not one thing** — there are two namespaces, and separating them is what
keeps human and machine content from colliding:

- **`authored/`** — the curated Markdown. Humans write it; it is authoritative for
  what it covers. Its long-term home is **its own repo/filesystem**; until that
  exists it stays in skilled-agent. Either way it reaches the fabric the same way:
  **pushed to `POST /ingest`** — by skilled-agent, a CI job, or a human running a
  CLI, from anywhere. The fabric treats it as a *source it ingests*, never something
  it owns or edits.

- **`generated/` — owned and served by the fabric.** The ingestion and semantic
  pipeline doesn't only build the graph; it *emits human-readable Markdown* as a
  by-product. A dense PDF becomes a doc/section/chunk **summary tree** (the
  "Markdown-shaped projection" from the vision doc); a graph slice becomes a
  **downward-projected page** of living documentation. All of this fabric-produced
  content lands in the `generated/` namespace, addressable and served over
  `GET /kb/generated/...`, each page carrying provenance back to its source.

**Why this answers "where does fabric-generated content go?"** — into `generated/`,
which the fabric persists (object store or a content store) and serves. It is a
*materialized read-view* of the semantic plane, **not re-ingested** (that would
create a feedback loop): the graph and vector index remain the source of truth;
`generated/` is the readable face of them. skilled-agent's browser and agent read
`authored/` and `generated/` through the **same** `GET /kb/...` path, so a dense-PDF
summary is as cheap to read on the fly as a hand-written page — while the authored
tree is never silently overwritten by machine output.

---

## 6. Deployment topologies

The separation buys three distinct shapes from the same code:

1. **Standalone** — `skilled-agent` alone, Kuzu/BM25. Today's product, unchanged;
   `RETRIEVAL_BACKEND=kuzu`.
2. **Integrated** — `skilled-agent` + `semantic-fabric` service (docker-compose or
   k8s); `RETRIEVAL_BACKEND=fabric`. The fabric brings its own graph store, vector
   DB, object store.
3. **Shared platform** — one `semantic-fabric` deployment serving *many*
   front-ends (skilled-agent, other agents, IDE tools via MCP). The fabric is an
   org-wide context/semantic layer; skilled-agent is one consumer.

### Infrastructure choices (decided)

All self-hostable (regulated posture) and behind semantica's abstractions, so each is
swappable by config rather than rewrite.

| Layer | Choice | Notes |
|---|---|---|
| Vector store | **Qdrant** | Purpose-built ANN; scales past pgvector for large corpora / high QPS. `VECTOR_STORE=qdrant`, `QDRANT_URL`. |
| Embeddings | **BGE-M3, self-hosted** | Data stays in the boundary; dense+sparse for hybrid; 8k context. `EMBEDDING_MODEL`, pinned with its dimension — re-embedding on change is expensive, so version the embedding namespace. Hosted (Voyage/OpenAI) only for non-sensitive tenants. |
| Graph store | **LPG now (Kuzu) → RDF later (Oxigraph)** | Kuzu gets GraphRAG traversal working fastest; adopt Oxigraph (SPARQL + OWL/SHACL + PROV-O) when Phase 3 reasoning arrives. `GRAPH_STORE=lpg\|rdf`. |
| Object store | **MinIO** | S3-compatible, self-hosted; original files + chart images. `OBJECT_STORE_URI`. |

Config keys the service reads: `VECTOR_STORE`, `QDRANT_URL`, `EMBEDDING_MODEL`,
`GRAPH_STORE`, `OBJECT_STORE_URI`, `ENABLE_REASONING`.

---

## 7. Security boundary (a bonus of separating)

- Enterprise connector credentials (Snowflake/SAP/Databricks) live only in the
  fabric — skilled-agent's blast radius shrinks.
- Agent ↔ fabric authenticated by service token or mTLS; per-caller scopes let the
  fabric enforce which sources a given front-end may query.
- The fabric is the single place to enforce SHACL/Datalog policy guardrails before
  answers leave the semantic plane.

---

## 8. Versioning & contract testing

- **Semantic versioning** on the API; the `EvidenceUnit` schema evolves by
  backward-compatible addition only (the linchpin — see the earlier spec).
- **Consumer-driven contract tests**: skilled-agent publishes its expectations;
  `semantic-fabric` CI runs them against the provider so a breaking change fails in
  the fabric's pipeline, not in production.
- `fabric-client` version pins the contract version skilled-agent expects.

---

## 9. Phasing under separation

- **Phase 0 — Scaffold the repo.** Create `semantic-fabric` with `contracts/` +
  `client/` + an `api/` skeleton returning stub evidence units. In skilled-agent,
  add `RemoteFabricBackend` + config; prove `RETRIEVAL_BACKEND=fabric` round-trips
  against the stub and falls back to `kuzu` when the service is down.
- **Phase 1 — Real retrieval.** Push the authored KB to `/ingest`; implement hybrid
  search + graph expansion over it; reach parity with today's results on a golden
  query set.
- **Phase 2 — Dense sources.** Add the PDF ingestion pipeline (incl. the figure/VLM
  branch) and one enterprise connector; emit the `generated/` namespace (summary
  trees + downward-projected pages) and serve it over `GET /kb/...`.
- **Phase 3 — Reasoning & decisions.** Enable `/reason` guardrails and decision
  recording; wire the agent's citations to provenance chains.
- **Phase 4 — Platform.** Point a second consumer at the fabric over MCP.

---

## 10. Decisions & remaining questions

**Decided:**

1. **Repo name** — **`semantic-fabric`**.
2. **Contract home** — `fabric-client` lives **in the `semantic-fabric` repo**
   (`client/`), published from it; no separate contracts repo.
3. **KB ingestion** — **push to `POST /ingest`** from anywhere. (The earlier
   pull-via-connector option is deferred; a connector can be added later for
   sources the fabric should poll itself.)
4. **Authored KB home** — its own repo/filesystem eventually; **for now it stays in
   skilled-agent** and is pushed to `/ingest`.
5. **Fabric-generated content** — lives in the fabric-owned **`generated/`
   namespace**, served over `GET /kb/generated/...`; it is a materialized read-view,
   never re-ingested and never written back over the authored tree.

**Still open:**

- **Ingest cadence** — on every authored-KB change (a push hook), on a schedule, or
  both? Affects freshness vs. cost.
- **`generated/` staleness** — regenerate a page eagerly when its underlying facts
  change, or lazily on read? (Leaning eager for hot pages, lazy otherwise.)
- **Auth model** — service token vs. mTLS, and how per-caller source scopes are
  expressed.
