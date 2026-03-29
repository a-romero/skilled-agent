# Skill-Aware Agent Loop

A minimal but production-quality implementation of an Anthropic SDK agent that lazily loads **skills** from a filesystem — mirroring how Claude Code discovers and reads skill files only when the current task warrants it.

---

## Architecture

```
skilled-agent/
├── agent.py                  ← agent loop + core tool handlers
└── skills/
    ├── python-coder/
    │   └── SKILL.md          ← instructions + tools_json block
    ├── summariser/
    │   └── SKILL.md          ← instructions only (no extra tools)
    └── <your-skill>/
        └── SKILL.md
```

### How it works

```
User task
   │
   ▼
list_skills ──► agent sees skill names + one-line descriptions
   │
   ▼
read_skill  ──► agent reads the full SKILL.md for relevant skills
   │              └─ if the skill defines a tools_json block,
   │                 those tools are unlocked for the rest of the run
   ▼
<skill tool> ──► agent calls write_file / run_python / etc.
   │
   ▼
Final text answer (stop_reason == "end_turn")
```

The agent **never reads a skill file it doesn't need** — skills are lazily pulled from disk only after the agent inspects the skill registry and decides a skill is relevant.

---

## Quick start

```bash
pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# default demo task
python agent.py

# custom task
python agent.py "Write a Python script that generates a random UUID and save it to ./output/uuid.py, then run it"
python agent.py "Summarise the following: <paste long text here>"
```

---

## Adding a new skill

1. Create `skills/<your-skill>/SKILL.md`
2. Add YAML frontmatter:

```yaml
---
name: your-skill
description: "One-line description the agent uses to decide whether to load this skill."
---
```

3. Write instructions in Markdown — the agent reads this in full before acting.

4. Optionally expose tools by adding a `tools_json` fenced block:

````markdown
```tools_json
[
  {
    "name": "my_tool",
    "description": "What it does.",
    "input_schema": {
      "type": "object",
      "properties": {
        "arg": { "type": "string", "description": "..." }
      },
      "required": ["arg"]
    }
  }
]
```
````

5. Register a handler in `agent.py`:

```python
SKILL_TOOL_HANDLERS["my_tool"] = lambda inp: my_handler(inp)
```

That's it — the agent will discover and load your skill automatically.

---

## Key design decisions

| Decision | Rationale |
|---|---|
| Skills scanned at startup, content read lazily | Fast startup; only pays I/O cost when the skill is needed |
| `list_skills` returns name + description only | Keeps context window lean; full instructions loaded on demand |
| `tools_json` block inside SKILL.md | Skills are self-contained; no separate config file needed |
| Tool handlers registered in `SKILL_TOOL_HANDLERS` | Clean separation between skill *definition* and *execution* |
| Full conversation history passed each turn | Standard Anthropic SDK multi-turn pattern; stateless per call |
| `MAX_ITERATIONS` guard | Prevents infinite loops in production |

---

## Environment

- Python 3.11+
- `anthropic` SDK (`pip install anthropic`)
- `ANTHROPIC_API_KEY` set in environment
