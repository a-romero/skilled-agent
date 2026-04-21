# LLM Provider Adapter Design

**Date:** 2026-04-10  
**Status:** Approved

## Overview

Extract all provider-specific LLM code from `agent.py` and `enrich_knowledge.py` into a standalone `llm.py` module. The module provides a unified interface over the Anthropic SDK and the OpenAI SDK (used against a LiteLLM endpoint), switchable via env vars with explicit parameter override. `llm.py` has no project-specific imports and can be copied into any other project as a library.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `llm.py` | Create | Client factory, normalised types, unified `complete()`, message builders |
| `agent.py` | Modify | Swap provider-specific calls for `llm.py` equivalents |
| `enrich_knowledge.py` | Modify | Swap provider-specific calls for `llm.py` equivalents |
| `tests/test_llm.py` | Create | Unit tests for all `llm.py` functions (no live API calls) |

---

## `llm.py` Module

### Configuration

Provider selection is resolved in this order: explicit parameter → env var → error.

| Env var | Purpose | Example |
|---------|---------|---------|
| `LLM_PROVIDER` | `"anthropic"` or `"litellm"` | `anthropic` |
| `LLM_MODEL` | Default model name | `claude-opus-4-5` |
| `ANTHROPIC_API_KEY` | Anthropic auth | — |
| `LITELLM_BASE_URL` | LiteLLM proxy URL | `http://localhost:4000` |
| `LITELLM_API_KEY` | LiteLLM auth | — |

### Types

```python
@dataclass
class LLMClient:
    provider: str   # "anthropic" | "litellm"
    model: str      # default model for this client
    _raw: Any       # underlying SDK client instance (private)

@dataclass
class ToolCall:
    id: str
    name: str
    input: dict     # always a dict, never a raw JSON string

@dataclass
class LLMResponse:
    is_done: bool           # True = final answer, no tool calls pending
    text: str               # populated when is_done=True, empty otherwise
    tool_calls: list[ToolCall]
    _raw: Any               # original SDK response, consumed by make_assistant_message
```

### Public Functions

```python
def create_client(
    provider: str | None = None,    # falls back to LLM_PROVIDER env var
    model: str | None = None,       # falls back to LLM_MODEL env var
    base_url: str | None = None,    # LiteLLM only; falls back to LITELLM_BASE_URL
    api_key: str | None = None,     # falls back to ANTHROPIC_API_KEY / LITELLM_API_KEY
) -> LLMClient
```

Constructs the appropriate SDK client and returns an `LLMClient`. Raises `ValueError` if required config is missing.

```python
def complete(
    client: LLMClient,
    messages: list[dict],
    system_prompt: str = "",
    tools: list[dict] = [],     # always in Anthropic format — converted internally
    max_tokens: int = 4096,
    model: str | None = None,   # overrides client.model for this call
) -> LLMResponse
```

Unified completion call. Handles tool format conversion, system prompt placement, and response normalisation internally. Returns a provider-agnostic `LLMResponse`.

```python
def make_assistant_message(response: LLMResponse) -> dict
```

Builds the assistant turn to append to the messages list. Provider-aware:
- Anthropic: `{"role": "assistant", "content": <raw content blocks>}`
- LiteLLM/OpenAI: `{"role": "assistant", "content": ..., "tool_calls": [...]}`

```python
def make_tool_result_messages(
    client: LLMClient, tool_call_id: str, result: str
) -> list[dict]
```

Builds tool result message(s) to extend onto the messages list:
- Anthropic: `[{"role": "user", "content": [{"type": "tool_result", "tool_use_id": id, "content": result}]}]`
- LiteLLM/OpenAI: `[{"role": "tool", "tool_call_id": id, "content": result}]`

### Private Helper

```python
def _convert_tools(tools: list[dict], provider: str) -> list[dict]
```

Converts Anthropic tool definitions to OpenAI format when `provider == "litellm"`:
- Renames `input_schema` → `parameters`
- Wraps each tool in `{"type": "function", "function": {...}}`

Called internally by `complete()`. Callers always pass Anthropic-format definitions.

---

## `agent.py` Changes

Replace the four provider-specific touchpoints:

```python
# 1. Client creation (replaces anthropic.Anthropic() + MODEL constant)
client = create_client()

# 2. API call (replaces client.messages.create(...))
response = complete(client, messages, system_prompt=system_prompt, tools=all_tools)

# 3. Stop check (replaces response.stop_reason == "end_turn")
if response.is_done:
    return response.text

# 4. Tool iteration (replaces for block in response.content)
for tool_call in response.tool_calls:
    result = dispatch(tool_call.name, tool_call.input)
    tool_results.extend(make_tool_result_messages(client, tool_call.id, str(result)))

# 5. Append assistant turn + tool results
messages.append(make_assistant_message(response))
messages.extend(tool_results)
```

Tool results are `extend`ed directly onto `messages` (not bundled under a single `user` turn) — correct for both providers.

---

## `enrich_knowledge.py` Changes

Simple swap — no tool use:

```python
# Client creation (replaces anthropic.Anthropic())
client = create_client()

# API call (replaces client.messages.create(...))
response = complete(
    client,
    messages=[{"role": "user", "content": prompt}],
    max_tokens=512,
    model="claude-haiku-4-5-20251001",   # or equivalent via LLM_MODEL env var
)

# Response access (replaces response.content[0].text)
raw = response.text
```

---

## Tests (`tests/test_llm.py`)

All unit tests — no live API calls. Mock SDK responses where needed.

| Test | Verifies |
|------|---------|
| `test_convert_tools_anthropic_passthrough` | Anthropic tools returned unchanged |
| `test_convert_tools_litellm_wraps_function` | `input_schema` → `parameters`, wrapped in `{"type": "function", ...}` |
| `test_make_assistant_message_anthropic` | Produces `{"role": "assistant", "content": <blocks>}` |
| `test_make_assistant_message_litellm` | Produces OpenAI-format message dict |
| `test_make_tool_result_messages_anthropic` | Returns single user message with `tool_result` content block |
| `test_make_tool_result_messages_litellm` | Returns single `{"role": "tool", ...}` message |
| `test_create_client_reads_env_vars` | Provider/model resolved from env when not passed explicitly |
| `test_create_client_explicit_params_override_env` | Explicit params take precedence over env vars |

---

## Error Handling

- `create_client()` raises `ValueError` with a clear message if required config is missing (e.g. `LLM_PROVIDER` not set and no explicit `provider` arg)
- `complete()` propagates SDK exceptions unchanged — callers handle retries
- Unknown provider string in `create_client()` raises `ValueError`

---

## Out of Scope

- Retry logic / exponential backoff
- Streaming responses
- More than two providers
- Token counting / cost tracking
