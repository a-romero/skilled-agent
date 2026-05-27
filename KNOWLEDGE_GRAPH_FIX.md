# Knowledge Graph Path Fix

## Issue
After moving backend files into `backend/` directory, the knowledge graph path was broken. The code was looking for `backend/knowledge/knowledge_graph/` instead of project root's `knowledge_graph/`.

## Fix Applied
Updated `backend/knowledge/knowledge_graph.py`:

```python
# Before:
GRAPH_ROOT = Path(__file__).parent / "knowledge_graph"
# → Resolves to: backend/knowledge/knowledge_graph/

# After:
GRAPH_ROOT = Path(__file__).parent.parent.parent / "knowledge_graph"
# → Resolves to: /Users/albertoromero/dev/s-va/knowledge_graph
```

## Current Status

✅ **Path fix committed** (commit 6ef5358)  
⚠️ **Knowledge graph doesn't exist yet** (`knowledge_graph/` directory not found)  
⚠️ **Missing Python dependencies** (kuzu, dspy, etc.)

## What This Means

The backend will show this warning when it starts:
```
UserWarning: Knowledge graph not available — run: uv run python enrich_knowledge.py
```

**This is OK!** The agent will still work, it just won't have graph-based search available. The warning is informational, not an error.

## To Create the Knowledge Graph (Optional)

If you want to enable graph-based knowledge search:

### 1. Install missing dependencies

```bash
cd backend
pip3 install kuzu rank-bm25
```

Or install all dependencies:
```bash
cd backend
pip3 install -e .
```

### 2. Run the enrichment script

```bash
cd /Users/albertoromero/dev/s-va
python3 -m backend.knowledge.enrich_knowledge
```

This will:
- Enrich frontmatter in all `.md` files (Phase 1) ✅ **Already done**
- Generate `SUMMARY.MD` navigation files (Phase 2) ✅ **Already done** 
- Create knowledge graph database (Phase 3) ⚠️ Needs kuzu installed

### 3. Restart backend

```bash
uvicorn backend.server:app --reload --port 8000
```

The warning should disappear once the graph exists.

## Why The Warning Appeared

When we moved files:
- `GRAPH_ROOT` was relative to `__file__` (knowledge_graph.py)
- After moving to `backend/knowledge/`, it pointed to wrong location
- Backend couldn't find `knowledge_graph/` directory
- Warning triggered informing you to run the enrichment script

## Bottom Line

✅ **Path is now correct**  
⚠️ **Graph doesn't exist yet** - but that's OK for basic functionality  
💡 **To enable graph search** - install kuzu and run enrichment script  

Your backend should run fine with the warning. The agent uses other methods (file reading, skills) that don't require the knowledge graph.

---

**Commit:** `6ef5358` - fix: correct knowledge_graph path after backend restructuring
