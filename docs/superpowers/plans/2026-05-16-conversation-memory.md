# Conversation Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the DSPy agent maintain context across follow-up questions within a conversation by sending the prior turns from the frontend with each request.

**Architecture:** The frontend already tracks `messages[]` per active conversation — we slice the last 6 completed turns and send them as `history` in the POST body. The server caps at 6, formats them as a plain-text transcript, and passes to the agent via a new `history` InputField on the DSPy signature. The server stays stateless.

**Tech Stack:** Python 3.12, DSPy, FastAPI, pytest, React (inline in HTML via Babel)

---

## Files touched

| File | Change |
|------|--------|
| `dspy_agent.py` | Add `_format_history`, update `KnowledgeAgentSignature`, `DSPyKnowledgeAgent.forward`, `run_agent` |
| `server.py` | Read `history` from POST body, cap at 6, pass to `run_agent` |
| `Open Virtual Assistant.html` | Collect last 6 completed turns in `runAgent`, include in POST body |
| `tests/test_dspy_agent_history.py` | New — unit tests for `_format_history` |
| `tests/test_server.py` | Add POST `/api/chat` tests (history accepted, capped, backward-compatible) |

---

## Task 1: `_format_history` — pure formatting function

**Files:**
- Create: `tests/test_dspy_agent_history.py`
- Modify: `dspy_agent.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_dspy_agent_history.py`:

```python
from dspy_agent import _format_history


def test_format_history_empty_returns_empty_string() -> None:
    assert _format_history([]) == ""


def test_format_history_single_user_turn() -> None:
    turns = [{"role": "user", "text": "What is group life insurance?"}]
    result = _format_history(turns)
    assert result == "User: What is group life insurance?"


def test_format_history_single_assistant_turn() -> None:
    turns = [{"role": "assistant", "text": "Group life is a policy covering employees."}]
    result = _format_history(turns)
    assert result == "Assistant: Group life is a policy covering employees."


def test_format_history_multiple_turns() -> None:
    turns = [
        {"role": "user", "text": "What is group life?"},
        {"role": "assistant", "text": "Group life is..."},
        {"role": "user", "text": "What about health?"},
    ]
    result = _format_history(turns)
    assert result == (
        "User: What is group life?\n"
        "Assistant: Group life is...\n"
        "User: What about health?"
    )
```

- [ ] **Step 2: Run to verify they fail**

```bash
uv run pytest tests/test_dspy_agent_history.py -v
```

Expected: `ImportError` — `_format_history` not defined yet.

- [ ] **Step 3: Implement `_format_history` in `dspy_agent.py`**

Add this function after the `load_dotenv()` call (around line 31), before the knowledge base setup block:

```python
def _format_history(turns: list[dict]) -> str:
    """Format conversation turns as a plain-text transcript for the agent."""
    if not turns:
        return ""
    lines = []
    for turn in turns:
        role = "User" if turn["role"] == "user" else "Assistant"
        lines.append(f"{role}: {turn['text']}")
    return "\n".join(lines)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_dspy_agent_history.py -v
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/test_dspy_agent_history.py dspy_agent.py
git commit -m "feat: add _format_history for conversation transcript formatting"
```

---

## Task 2: DSPy signature + agent forward

**Files:**
- Modify: `dspy_agent.py` (lines ~217–260)
- Modify: `tests/test_dspy_agent_history.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_dspy_agent_history.py`:

```python
import dspy
from unittest.mock import MagicMock
from dspy_agent import DSPyKnowledgeAgent


def test_agent_forward_passes_history_to_react() -> None:
    """forward() includes history when calling the ReAct module."""
    calls: list[dict] = []

    class _MockReAct:
        def __call__(self, **kwargs: object) -> dspy.Prediction:
            calls.append(kwargs)
            return dspy.Prediction(answer="ok")

    agent = DSPyKnowledgeAgent()
    agent.react = _MockReAct()

    agent.forward(
        question="What about health?",
        knowledge_index="idx",
        history="User: What is group life?\nAssistant: Group life is...",
    )

    assert len(calls) == 1
    assert calls[0]["history"] == "User: What is group life?\nAssistant: Group life is..."
    assert calls[0]["question"] == "What about health?"
```

- [ ] **Step 2: Run to verify it fails**

```bash
uv run pytest tests/test_dspy_agent_history.py::test_agent_forward_passes_history_to_react -v
```

Expected: `TypeError` — `forward()` does not accept `history`.

- [ ] **Step 3: Update `KnowledgeAgentSignature` to add the `history` field**

In `dspy_agent.py`, find `class KnowledgeAgentSignature` (around line 217). Add one line to the docstring and the new field:

```python
class KnowledgeAgentSignature(dspy.Signature):
    """Answer customer queries about Aviva's products and services.

    You have access to a skill library and a knowledge base.

    If prior conversation history is provided, use it to understand follow-up
    questions and maintain context across turns.

    Skills:
    1. Call list_skills_tool to discover available skills and their descriptions.
    2. Call read_skill_tool with a skill name only if you have determined it is relevant.

    Knowledge base:
    3. Use search_knowledge_graph_tool as your primary navigation method:
       - Call it with the user's query and a section if the domain is clear.
       - Review the returned titles and summaries to pick the 1-2 most relevant pages.
       - Call read_knowledge to retrieve full content from those paths.
    4. Only fall back to SUMMARY.MD navigation via read_knowledge if search returns no results.
    5. Always cite sources (title and URL) at the end of your answer.

    Format your sources section as:
    ## Sources
    - [Page Title](https://url)
    """

    knowledge_index: str = dspy.InputField(
        desc="Top-level knowledge index (SUMMARY.MD) for fallback navigation"
    )
    history: str = dspy.InputField(
        desc="Prior conversation turns, oldest first. Empty string if this is the first question."
    )
    question: str = dspy.InputField(desc="Customer question to answer")
    answer: str = dspy.OutputField(
        desc="Complete answer with ## Sources section listing every page read"
    )
```

- [ ] **Step 4: Update `DSPyKnowledgeAgent.forward` to accept and pass `history`**

Find `class DSPyKnowledgeAgent` (around line 248). Update `forward`:

```python
def forward(self, question: str, knowledge_index: str, history: str = "") -> dspy.Prediction:
    """Run the ReAct loop for a given question."""
    return self.react(question=question, knowledge_index=knowledge_index, history=history)
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
uv run pytest tests/test_dspy_agent_history.py -v
```

Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add dspy_agent.py tests/test_dspy_agent_history.py
git commit -m "feat: add history field to KnowledgeAgentSignature and agent forward"
```

---

## Task 3: `run_agent` + server history passing

**Files:**
- Modify: `dspy_agent.py` (`run_agent` function, ~line 267)
- Modify: `server.py` (`chat` endpoint, ~line 202)
- Modify: `tests/test_server.py`

- [ ] **Step 1: Write the failing server tests**

Append to `tests/test_server.py`:

```python
from unittest.mock import MagicMock, patch


def test_chat_accepts_history_field() -> None:
    """POST /api/chat with a history list returns 200."""
    with patch("dspy_agent.run_agent", return_value="Test answer."):
        resp = client.post("/api/chat", json={
            "question": "follow-up question",
            "history": [
                {"role": "user", "text": "first question"},
                {"role": "assistant", "text": "first answer"},
            ],
        })
    assert resp.status_code == 200


def test_chat_backward_compatible_without_history() -> None:
    """POST /api/chat without history field still returns 200."""
    with patch("dspy_agent.run_agent", return_value="Test answer."):
        resp = client.post("/api/chat", json={"question": "standalone question"})
    assert resp.status_code == 200


def test_chat_passes_history_to_run_agent() -> None:
    """Server passes the received history to run_agent."""
    mock_run = MagicMock(return_value="Answer.")
    with patch("dspy_agent.run_agent", mock_run):
        client.post("/api/chat", json={
            "question": "follow-up",
            "history": [
                {"role": "user", "text": "Q1"},
                {"role": "assistant", "text": "A1"},
            ],
        })
    mock_run.assert_called_once()
    kwargs = mock_run.call_args.kwargs
    assert kwargs["history"] == [
        {"role": "user", "text": "Q1"},
        {"role": "assistant", "text": "A1"},
    ]


def test_chat_caps_history_at_six_turns() -> None:
    """Server discards turns beyond the last 6 before calling run_agent."""
    mock_run = MagicMock(return_value="Answer.")
    long_history = [
        {"role": "user" if i % 2 == 0 else "assistant", "text": f"turn {i}"}
        for i in range(10)
    ]
    with patch("dspy_agent.run_agent", mock_run):
        client.post("/api/chat", json={"question": "q", "history": long_history})
    kwargs = mock_run.call_args.kwargs
    assert len(kwargs["history"]) == 6
    assert kwargs["history"] == long_history[-6:]
```

- [ ] **Step 2: Run to verify they fail**

```bash
uv run pytest tests/test_server.py::test_chat_accepts_history_field tests/test_server.py::test_chat_backward_compatible_without_history tests/test_server.py::test_chat_passes_history_to_run_agent tests/test_server.py::test_chat_caps_history_at_six_turns -v
```

Expected: `TypeError` — `run_agent()` got unexpected keyword argument `history`.

- [ ] **Step 3: Update `run_agent` in `dspy_agent.py` to accept and use `history`**

Find `def run_agent(` (around line 267). Add the `history` parameter and pass the formatted transcript to the agent call:

```python
def run_agent(
    task: str,
    verbose: bool = True,
    event_callback: Callable[[dict], None] | None = None,
    history: list[dict] | None = None,
) -> str:
    """Run the DSPy ReAct agent for a given task. Returns the final answer.

    Args:
        task: The question or task to answer.
        verbose: Whether to print progress to stdout.
        event_callback: Optional callable invoked with event dicts as the agent
            works.  Events match the frontend protocol:
              {"kind": "read",  "path": "..."}
              {"kind": "think", "text": "..."}
        history: Prior conversation turns as list of {"role": ..., "text": ...} dicts.
    """
    if history is None:
        history = []
    ...
```

Then find the agent call (around line 331) and update it:

```python
        result = agent(
            question=task,
            knowledge_index=knowledge_index,
            history=_format_history(history),
        )
```

- [ ] **Step 4: Update `server.py` to read and pass `history`**

Find `async def chat(` (around line 202). After reading `question`, add history extraction with the 6-turn cap:

```python
    body = await request.json()
    question: str = body.get("question", "").strip()
    history: list[dict] = body.get("history", [])[-6:]
    if not question:
        ...
```

Then in the `_run()` inner function, pass `history` to `run_agent`:

```python
            answer = dspy_agent.run_agent(
                task=question,
                verbose=False,
                event_callback=on_event,
                history=history,
            )
```

Note: `history` is captured from the outer scope of `chat()` — this is intentional and consistent with how `question` is already used by `_run`.

- [ ] **Step 5: Run all server tests**

```bash
uv run pytest tests/test_server.py -v
```

Expected: all tests pass (including the original 4 skills tests).

- [ ] **Step 6: Run the full test suite to check for regressions**

```bash
uv run pytest -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add dspy_agent.py server.py tests/test_server.py
git commit -m "feat: thread conversation history through run_agent and server chat endpoint"
```

---

## Task 4: Frontend — collect and send history

**Files:**
- Modify: `Open Virtual Assistant.html` (`runAgent` function, around line 1844)

No automated test for this task — conversation-level isolation is verified manually (steps below).

- [ ] **Step 1: Add history collection to `runAgent`**

In `Open Virtual Assistant.html`, find `async function runAgent(userQuery) {` (around line 1844).

Add the history collection immediately after the opening line, before `setBusy(true)`:

```js
  async function runAgent(userQuery) {
    // Capture completed turns before adding the new in-progress message.
    const historyTurns = messages
      .filter(m => m.role === "user" || (m.role === "assistant" && m.text && !m.running))
      .slice(-6)
      .map(m => ({ role: m.role, text: m.text }));

    setBusy(true);
    // ... rest of function unchanged until the fetch call
```

- [ ] **Step 2: Include `history` in the POST body**

Find the `fetch("/api/chat", ...)` call (around line 1860). Update the `body`:

```js
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userQuery, history: historyTurns }),
      });
```

- [ ] **Step 3: Manual smoke test — follow-up question resolves correctly**

Start the server:
```bash
uv run uvicorn backend.server:app --reload --port 8000
```

Open http://localhost:8000 in a browser. Ask:

1. "What is group life insurance?"
2. "What does Aviva offer for that?" ← should reference the first answer's context

Verify the second answer references group life without re-explaining the concept from scratch.

- [ ] **Step 4: Manual isolation test — switching conversations does not bleed context**

1. Send "What is group life insurance?" → get answer
2. Click **New conversation**
3. Send "What did I just ask about?" → the agent should NOT know about group life (no history sent)
4. Load the first conversation from the history sidebar
5. Send "Can you expand on that?" → should correctly reference group life

- [ ] **Step 5: Commit**

```bash
git add "Open Virtual Assistant.html"
git commit -m "feat: send conversation history with each chat request"
```
