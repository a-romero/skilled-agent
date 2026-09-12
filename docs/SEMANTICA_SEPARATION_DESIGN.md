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

- **`fabric-client`** (published from `semantic-fabric`, or a third `contracts` repo
  if you prefer strict neutrality): contract types (the `EvidenceUnit` schema) + an
  HTTP/MCP client. Tiny dependency surface (`httpx`, `pydantic`). skilled-agent
  depends on **this only** — never on `semantica`.
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
| Deterministic reasoning | `POST /reason` | `fabric.reason` | answer + rule trace |
| Ingest a source | `POST /ingest` (async) | `fabric.ingest` | job id |
| Job status | `GET /jobs/{id}` | — | status |
| Record / trace decision | `POST /decisions`, `GET /decisions/{id}/chain` | `fabric.record_decision` | decision + provenance |

---

## 5. Data ownership — who stores what

| Data | Owner repo/service | Notes |
|---|---|---|
| Markdown KB (curated, authored) | **skilled-agent** (Git) | The editorial plane stays authoritative here. |
| Context Graph, facts, ontology | **semantic-fabric** | Derived semantic plane. |
| Vector index | semantic-fabric | pgvector / Qdrant behind semantica. |
| Original files + chart images | semantic-fabric | Object store (S3/MinIO). |
| Provenance + decisions | semantic-fabric | PROV-O lineage. |
| Enterprise credentials | semantic-fabric | Never in skilled-agent. |

**The Markdown KB is a *source the fabric ingests*, not something it owns.** The
fabric pulls the KB via a Git connector (or a webhook on push) and extracts it into
the semantic plane. Downward-projected Markdown ("living documentation" from graph
slices) flows back either as **PRs into the KB repo** or served under a separate
`generated/` namespace — the human-authored tree is never silently overwritten.

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
- **Phase 1 — Real retrieval.** Implement hybrid search + graph expansion in the
  fabric over the ingested Markdown KB; reach parity with today's results on a
  golden query set.
- **Phase 2 — Dense sources.** Add the PDF ingestion pipeline (incl. the figure/VLM
  branch) and one enterprise connector; downward-project Markdown back to the KB.
- **Phase 3 — Reasoning & decisions.** Enable `/reason` guardrails and decision
  recording; wire the agent's citations to provenance chains.
- **Phase 4 — Platform.** Point a second consumer at the fabric over MCP.

---

## 10. Open questions

1. **Contract home** — publish `fabric-client` from the `semantic-fabric` repo, or
   split a neutral third `contracts` repo? (Default: from `semantic-fabric` for
   fewer moving parts.)
2. **KB sync direction** — does the fabric pull the KB (Git connector/webhook), or
   does skilled-agent push changes to `/ingest`? (Default: pull, so the fabric owns
   its ingestion cadence.)
3. **Downward projection** — PRs into the KB repo vs. a served `generated/`
   namespace? Affects human review workflow.
4. **Repo name** — `semantic-fabric`, `context-layer`, `knowledge-fabric`?
