# Conversation Memory — Design Spec

**Date:** 2026-05-16  
**Status:** Approved  
**Approach:** Client-sends-history (Option A); Option C (Redis) earmarked for future migration

---

## Overview

Enable the DSPy agent to maintain context across follow-up questions within a single conversation. History is owned by the frontend (which already tracks it per-conversation) and sent with each request. The server remains stateless.

---

## Architecture

```
Frontend (React)
  └─ messages[] scoped to activeChat
  └─ on send: slice last 6 completed turns → POST /api/chat { question, history }

Server (FastAPI)
  └─ /api/chat reads history[], caps at 6 turns, formats as transcript string
  └─ calls run_agent(task, history, ...)

dspy_agent.py
  └─ _format_history(turns) → str
  └─ run_agent(task, history=[], ...) passes formatted string to agent
  └─ KnowledgeAgentSignature gains history: str InputField
```

---

## API Contract

`POST /api/chat` request body:

```json
{
  "question": "What about for health insurance?",
  "history": [
    { "role": "user",      "text": "What is group life insurance?" },
    { "role": "assistant", "text": "Group life insurance is..." }
  ]
}
```

- `history` is optional; omitting it or sending `[]` is equivalent (backward-compatible)
- Each turn: `{ "role": "user" | "assistant", "text": string }`
- Server caps at 6 turns (3 exchanges) before passing to the agent

---

## DSPy Signature

```python
class KnowledgeAgentSignature(dspy.Signature):
    knowledge_index: str = dspy.InputField(...)
    history: str = dspy.InputField(
        desc="Prior conversation turns, oldest first. Empty string if this is the first question."
    )
    question: str = dspy.InputField(desc="Customer question to answer")
    answer: str = dspy.OutputField(...)
```

History is formatted as a plain-text transcript in `dspy_agent.py`:

```
User: What is group life insurance?
Assistant: Group life insurance is...
```

A dedicated `_format_history(turns: list[dict]) -> str` function handles this. An empty list returns `""`.

---

## Server changes (`server.py`)

- Read `history` from POST body (default `[]`)
- Cap: `history = history[-6:]`
- Pass to `dspy_agent.run_agent(task=question, history=history, ...)`

---

## Agent changes (`dspy_agent.py`)

- `_format_history(turns: list[dict]) -> str` — pure formatting function
- `run_agent` gains `history: list[dict] = []` parameter
- Formatted history passed as `history=_format_history(history)` when calling `agent()`
- `DSPyKnowledgeAgent.forward` signature updated to accept and forward `history`

---

## Frontend changes (`Open Virtual Assistant.html`)

In `runAgent`, before the `fetch`:

```js
const historyTurns = messages
  .filter(m => m.role === "user" || (m.role === "assistant" && m.text && !m.running))
  .slice(-6)
  .map(m => ({ role: m.role, text: m.text }));
```

`body: JSON.stringify({ question: userQuery, history: historyTurns })`

No other frontend changes needed. Conversation-level isolation is free because `messages` is already scoped to `activeChat` and cleared on `newChat` / restored on `loadConversation`.

---

## Constraints and decisions

| Decision | Rationale |
|----------|-----------|
| Cap at 6 turns | Bounds token usage; covers typical follow-up depth |
| Plain-text transcript format | Simple, LLM-readable; easy to swap for `dspy.History` when migrating to Option C |
| Empty string when no history | Cleaner than `None`; DSPy handles empty InputFields gracefully |
| Client owns history | Avoids server state; conversation isolation free; survives server restarts |

---

## Future migration path (Option C — Redis)

When moving to Redis:
1. Server generates/assigns a `conversation_id` per chat session
2. Server reads/writes history to Redis keyed by `conversation_id`
3. Frontend sends `conversation_id` instead of `history[]`
4. `_format_history` and the DSPy signature remain unchanged

The `history: str` InputField on the signature is forward-compatible with this change.

---

## Testing

- Unit test `_format_history`: empty list, single turn, multiple turns, truncation
- Integration test: two-turn conversation via `/api/chat` — second response references first
- Frontend: manual verification that switching conversations does not bleed context
