# TODO

## Decision recording: chunk-level evidence lineage (Option B)

**Context:** `RemoteFabricBackend.record_decision` currently records the **page paths**
the agent read as the decision's evidence (Option A). This is because
`RemoteFabricBackend.search()` projects fabric results through `EvidenceUnit.to_legacy()`,
which keeps only `{path, title, summary}` and **drops the evidence-unit `id`**. So the
decision chain in semantic-fabric links decisions to *source pages*, not to the fabric's
fine-grained chunk / evidence-unit ids.

**Do later (full-fidelity lineage):**
- Add a `search_evidence()` path on `RemoteFabricBackend` that preserves the full
  `EvidenceUnit` (including `id`, `provenance`, `type`), rather than only the legacy trio.
- Have the DSPy agent track the evidence-unit `id`s it actually used (not just page
  paths) through the retrieve → read → synthesize flow.
- Pass those ids as `Decision.evidence` so `/decisions/{id}/chain` resolves to
  chunk-level provenance (page → chunk → source doc/bbox), not just page paths.
- Keep Option A as the fallback when only legacy results are available.
