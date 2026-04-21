# Skills UI — Design Spec
**Date:** 2026-04-21

## Overview

Surface the agent's skill library in the Open Virtual Assistant UI: a collapsible Skills panel in the middle (Knowledge) pane, and real-time skill usage events in the Thought Process trace.

---

## Backend Changes

### New endpoint: `GET /api/skills`

Added to `server.py`. Calls `build_skill_registry(SKILLS_ROOT)` (already implemented in `skills.py`) and returns the registry as a JSON array:

```json
[{"name": "python-coder", "description": "Writes and reviews Python code"}, ...]
```

`SKILLS_ROOT` is `_HERE / "skills"` (resolved from `__file__`, matching the `KNOWLEDGE_ROOT` pattern in `server.py`).

### New SSE events in `dspy_agent.py`

Two instrumented wrappers, following the existing `_instrumented_read` pattern:

**`list_skills_tool`** emits before returning:
```json
{"kind": "skill_list"}
```

**`read_skill_tool(skill_name)`** emits before returning:
```json
{"kind": "skill_read", "name": "<skill_name>", "desc": "<one-line description from registry>"}
```

The `on_event` handler in `server.py /api/chat` already forwards all events to the SSE stream — no changes needed there.

---

## Frontend Changes (`Open Virtual Assistant.html`)

### Skills state

Replace the current `skills: []` (never populated) with data from `/api/skills`:

```js
// on mount, alongside /api/knowledge/tree fetch
fetch("/api/skills")
  .then(r => r.json())
  .then(data => setSkills(data));  // [{name, description}]
```

Add two new state variables:
- `readingSkill` — `string | null` — skill name currently being read (drives highlight)
- `usedSkillsInTurn` — `Set<string>` — skills used this turn (drives post-turn accent bar)

Reset both in `newChat()` and `loadConversation()`.

### `<SkillsPanel>` component

New component rendered in the middle pane, directly below `<KnowledgeTree>` (above the `FilePreview` overlay). Layout: collapsible accordion.

**Structure:**
```
┌─────────────────────────────────────┐
│ ⚡ Skills              [2]  ▾        │  ← header (click to collapse)
├─────────────────────────────────────┤
│ [SKILL] python-coder                │
│         Writes and reviews Python…  │
│ [SKILL] summariser                  │  ← body (collapsible)
│         Summarises long documents   │
└─────────────────────────────────────┘
```

- `SKILL` badge: purple (`oklch(0.6 0.14 300)` — matches existing CSS)
- Name: bold, `var(--text)`
- Description: muted, `var(--text-3)`, truncated with ellipsis
- When `readingSkill === skill.name`: row gets warm pulse animation (same `readPulse` keyframe used by knowledge rows)
- After turn ends, rows in `usedSkillsInTurn` get the accent left-bar marker (same `.read-in-turn::before` pattern)
- Starts expanded; state not persisted

### `runAgent` SSE handler — new event kinds

```js
} else if (evt.kind === "skill_list") {
  updateMsg(m => ({ ...m, trace: [...m.trace,
    { kind: "skill", name: "list_skills", desc: "Browsed skill library" }
  ]}));

} else if (evt.kind === "skill_read") {
  setReadingSkill(evt.name);
  updateMsg(m => ({ ...m, trace: [...m.trace,
    { kind: "skill", name: evt.name, desc: evt.desc }
  ]}));
  await new Promise(r => setTimeout(r, 300));
  setUsedSkillsInTurn(prev => new Set(prev).add(evt.name));
  setReadingSkill(null);
}
```

### Thought Process (`<Trace>`)

Already renders `s.kind === "skill"` steps — **no changes needed**. The existing rendering displays:
```
● [SKILL] <name> · <desc>
```

---

## CSS additions

All new CSS follows existing conventions in the file:

- `.spane` — skills panel container (border-top, flex column)
- `.spane-header` — collapsible header row (matches `.kpane-header` style)
- `.spane-body` — skill rows container
- `.skill-row` — individual skill row (flex, gap, padding matching `.krow`)
- `.skill-row.reading` — warm pulse (reuses `readPulse` animation)
- `.skill-row.used-in-turn::before` — accent left bar (matches `.krow.read-in-turn::before`)

---

## Out of scope

- Clicking a skill to preview its `SKILL.md` content
- Searching/filtering skills
- Persisting skills-used across conversation history restore
