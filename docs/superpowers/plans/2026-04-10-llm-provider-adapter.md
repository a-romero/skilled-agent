# LLM Provider Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract provider-specific LLM code into a standalone `llm.py` module that presents a unified interface over Anthropic and LiteLLM (OpenAI-compatible), switchable via env vars.

**Architecture:** A new `llm.py` module defines three dataclasses (`LLMClient`, `ToolCall`, `LLMResponse`) and five functions (`create_client`, `complete`, `make_assistant_message`, `make_tool_result_messages`, `_convert_tools`). `agent.py` and `enrich_knowledge.py` swap their direct SDK calls for these equivalents. `llm.py` has zero project-specific imports.

**Tech Stack:** Python 3.10+, `anthropic` SDK, `openai` SDK (against LiteLLM proxy), `pytest`, `uv`

---

## File Map

| File | Action |
|------|--------|
| `llm.py` | Create |
| `tests/test_llm.py` | Create |
| `agent.py` | Modify — swap 4 provider-specific touchpoints |
| `enrich_knowledge.py` | Modify — swap client creation + API call |
| `tests/test_enrich_knowledge.py` | Modify — update 4 tests that mocked old SDK interface |
| `pyproject.toml` | Modify — add `openai` and `anthropic` to dependencies |

---

## Task 1: Add dependencies

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Add `openai` and `anthropic` to pyproject.toml**

Open `pyproject.toml` and update the `dependencies` list:

```toml
dependencies = [
    "pyyaml",
    "anthropic",
    "openai",
]
```

- [ ] **Step 2: Sync the venv**

```bash
uv sync
```

Expected: Lock file updated, `openai` package installed in `.venv`.

- [ ] **Step 3: Verify both packages import**

```bash
uv run python -c "import anthropic; import openai; print('ok')"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml uv.lock
git commit -m "chore: add anthropic and openai to project dependencies"
```

---

## Task 2: Scaffold `llm.py` with dataclasses and stubs

**Files:**
- Create: `llm.py`

- [ ] **Step 1: Create `llm.py` with dataclasses and function stubs**

Create `/home/alberto/lab/jointly/jointly/skilled-agent/llm.py`:

```python
"""Unified LLM client for Anthropic and LiteLLM (OpenAI-compatible) providers."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any

import anthropic
from openai import OpenAI


@dataclass
class LLMClient:
    """Holds provider identity, default model, and the underlying SDK client."""

    provider: str  # "anthropic" | "litellm"
    model: str     # default model for this client
    _raw: Any = field(repr=False, compare=False)  # underlying SDK client


@dataclass
class ToolCall:
    """Normalised tool invocation from any provider."""

    id: str
    name: str
    input: dict  # always a dict, never a raw JSON string


@dataclass
class LLMResponse:
    """Normalised response from any provider."""

    is_done: bool           # True = final answer, no tool calls pending
    text: str               # populated when is_done=True, empty otherwise
    tool_calls: list[ToolCall]
    _raw: Any = field(repr=False, compare=False)  # original SDK response


def _convert_tools(tools: list[dict], provider: str) -> list[dict]:
    """Convert Anthropic-format tool definitions to OpenAI format for LiteLLM."""
    raise NotImplementedError


def create_client(
    provider: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
    api_key: str | None = None,
) -> LLMClient:
    """Construct the appropriate SDK client and return an LLMClient."""
    raise NotImplementedError


def complete(
    client: LLMClient,
    messages: list[dict],
    system_prompt: str = "",
    tools: list[dict] = [],
    max_tokens: int = 4096,
    model: str | None = None,
) -> LLMResponse:
    """Unified completion call. Returns a provider-agnostic LLMResponse."""
    raise NotImplementedError


def make_assistant_message(response: LLMResponse) -> dict:
    """Build the assistant turn dict to append to the messages list."""
    raise NotImplementedError


def make_tool_result_messages(
    client: LLMClient, tool_call_id: str, result: str
) -> list[dict]:
    """Build tool result message(s) to extend onto the messages list."""
    raise NotImplementedError
```

- [ ] **Step 2: Verify the module imports without error**

```bash
uv run python -c "from llm import LLMClient, ToolCall, LLMResponse, create_client, complete, make_assistant_message, make_tool_result_messages; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add llm.py
git commit -m "feat: scaffold llm.py with dataclasses and stubs"
```

---

## Task 3: Implement `_convert_tools`

**Files:**
- Modify: `llm.py`
- Create: `tests/test_llm.py`

- [ ] **Step 1: Create `tests/test_llm.py` with `_convert_tools` tests**

```python
"""Unit tests for llm.py — no live API calls."""
import json
from unittest.mock import MagicMock, patch
import pytest
import anthropic
import openai

from llm import (
    LLMClient,
    LLMResponse,
    ToolCall,
    _convert_tools,
    create_client,
    complete,
    make_assistant_message,
    make_tool_result_messages,
)


# ---------------------------------------------------------------------------
# _convert_tools
# ---------------------------------------------------------------------------

def test_convert_tools_anthropic_passthrough() -> None:
    tools = [
        {
            "name": "my_tool",
            "description": "does stuff",
            "input_schema": {"type": "object", "properties": {}},
        }
    ]
    result = _convert_tools(tools, "anthropic")
    assert result is tools  # same object, not a copy


def test_convert_tools_litellm_wraps_function() -> None:
    tools = [
        {
            "name": "my_tool",
            "description": "does stuff",
            "input_schema": {"type": "object", "properties": {"x": {"type": "string"}}},
        }
    ]
    result = _convert_tools(tools, "litellm")
    assert len(result) == 1
    assert result[0]["type"] == "function"
    fn = result[0]["function"]
    assert fn["name"] == "my_tool"
    assert fn["description"] == "does stuff"
    assert fn["parameters"] == {"type": "object", "properties": {"x": {"type": "string"}}}
    assert "input_schema" not in fn
```

- [ ] **Step 2: Run tests to see them fail**

```bash
uv run pytest tests/test_llm.py::test_convert_tools_anthropic_passthrough tests/test_llm.py::test_convert_tools_litellm_wraps_function -v
```

Expected: Both FAIL with `NotImplementedError`

- [ ] **Step 3: Implement `_convert_tools` in `llm.py`**

Replace the stub:

```python
def _convert_tools(tools: list[dict], provider: str) -> list[dict]:
    """Convert Anthropic-format tool definitions to OpenAI format for LiteLLM."""
    if provider != "litellm":
        return tools
    result = []
    for tool in tools:
        fn = {k: v for k, v in tool.items() if k != "input_schema"}
        if "input_schema" in tool:
            fn["parameters"] = tool["input_schema"]
        result.append({"type": "function", "function": fn})
    return result
```

- [ ] **Step 4: Run tests to see them pass**

```bash
uv run pytest tests/test_llm.py::test_convert_tools_anthropic_passthrough tests/test_llm.py::test_convert_tools_litellm_wraps_function -v
```

Expected: Both PASS

- [ ] **Step 5: Commit**

```bash
git add llm.py tests/test_llm.py
git commit -m "feat: implement _convert_tools with tests"
```

---

## Task 4: Implement `create_client`

**Files:**
- Modify: `llm.py`
- Modify: `tests/test_llm.py`

- [ ] **Step 1: Add `create_client` tests to `tests/test_llm.py`**

Append to `tests/test_llm.py`:

```python
# ---------------------------------------------------------------------------
# create_client
# ---------------------------------------------------------------------------

def test_create_client_reads_env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("LLM_MODEL", "claude-haiku-4-5-20251001")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    client = create_client()
    assert client.provider == "anthropic"
    assert client.model == "claude-haiku-4-5-20251001"
    assert client._raw is not None


def test_create_client_explicit_params_override_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("LLM_MODEL", "env-model")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "env-key")
    client = create_client(provider="anthropic", model="override-model")
    assert client.model == "override-model"


def test_create_client_raises_if_provider_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.setenv("LLM_MODEL", "some-model")
    with pytest.raises(ValueError, match="LLM_PROVIDER"):
        create_client()


def test_create_client_raises_if_model_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "key")
    with pytest.raises(ValueError, match="LLM_MODEL"):
        create_client()


def test_create_client_raises_on_unknown_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "bogus")
    monkeypatch.setenv("LLM_MODEL", "some-model")
    with pytest.raises(ValueError, match="Unknown provider"):
        create_client()


def test_create_client_litellm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "litellm")
    monkeypatch.setenv("LLM_MODEL", "gpt-4")
    monkeypatch.setenv("LITELLM_BASE_URL", "http://localhost:4000")
    monkeypatch.setenv("LITELLM_API_KEY", "test-key")
    client = create_client()
    assert client.provider == "litellm"
    assert client.model == "gpt-4"
    assert client._raw is not None
```

- [ ] **Step 2: Run tests to see them fail**

```bash
uv run pytest tests/test_llm.py -k "create_client" -v
```

Expected: All FAIL with `NotImplementedError`

- [ ] **Step 3: Implement `create_client` in `llm.py`**

Replace the stub:

```python
def create_client(
    provider: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
    api_key: str | None = None,
) -> LLMClient:
    """Construct the appropriate SDK client and return an LLMClient."""
    provider = provider or os.environ.get("LLM_PROVIDER")
    if not provider:
        raise ValueError(
            "LLM_PROVIDER env var not set and no explicit provider passed"
        )
    model = model or os.environ.get("LLM_MODEL")
    if not model:
        raise ValueError(
            "LLM_MODEL env var not set and no explicit model passed"
        )

    if provider == "anthropic":
        key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        raw: Any = anthropic.Anthropic(api_key=key)
    elif provider == "litellm":
        base_url = base_url or os.environ.get("LITELLM_BASE_URL")
        key = api_key or os.environ.get("LITELLM_API_KEY")
        raw = OpenAI(base_url=base_url, api_key=key or "placeholder")
    else:
        raise ValueError(
            f"Unknown provider: {provider!r}. Must be 'anthropic' or 'litellm'"
        )

    return LLMClient(provider=provider, model=model, _raw=raw)
```

- [ ] **Step 4: Run tests to see them pass**

```bash
uv run pytest tests/test_llm.py -k "create_client" -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add llm.py tests/test_llm.py
git commit -m "feat: implement create_client with tests"
```

---

## Task 5: Implement `complete`

**Files:**
- Modify: `llm.py`
- Modify: `tests/test_llm.py`

- [ ] **Step 1: Add `complete` tests to `tests/test_llm.py`**

Append to `tests/test_llm.py`:

```python
# ---------------------------------------------------------------------------
# complete
# ---------------------------------------------------------------------------

def _make_anthropic_client() -> LLMClient:
    return LLMClient(provider="anthropic", model="claude-test", _raw=MagicMock())


def _make_litellm_client() -> LLMClient:
    return LLMClient(provider="litellm", model="gpt-test", _raw=MagicMock())


def test_complete_anthropic_end_turn() -> None:
    client = _make_anthropic_client()
    mock_block = MagicMock()
    mock_block.type = "text"
    mock_block.text = "Hello world"
    mock_raw = MagicMock(spec=anthropic.types.Message)
    mock_raw.stop_reason = "end_turn"
    mock_raw.content = [mock_block]
    client._raw.messages.create.return_value = mock_raw

    response = complete(client, [{"role": "user", "content": "Hi"}])

    assert response.is_done is True
    assert response.text == "Hello world"
    assert response.tool_calls == []
    assert response._raw is mock_raw


def test_complete_anthropic_tool_use() -> None:
    client = _make_anthropic_client()
    mock_tool_block = MagicMock()
    mock_tool_block.type = "tool_use"
    mock_tool_block.id = "toolu_01"
    mock_tool_block.name = "my_tool"
    mock_tool_block.input = {"key": "value"}
    mock_raw = MagicMock(spec=anthropic.types.Message)
    mock_raw.stop_reason = "tool_use"
    mock_raw.content = [mock_tool_block]
    client._raw.messages.create.return_value = mock_raw

    response = complete(client, [{"role": "user", "content": "Do it"}])

    assert response.is_done is False
    assert response.text == ""
    assert len(response.tool_calls) == 1
    assert response.tool_calls[0].id == "toolu_01"
    assert response.tool_calls[0].name == "my_tool"
    assert response.tool_calls[0].input == {"key": "value"}


def test_complete_anthropic_passes_system_and_tools() -> None:
    client = _make_anthropic_client()
    mock_raw = MagicMock(spec=anthropic.types.Message)
    mock_raw.stop_reason = "end_turn"
    mock_raw.content = []
    client._raw.messages.create.return_value = mock_raw
    tools = [{"name": "t", "description": "d", "input_schema": {"type": "object"}}]

    complete(
        client,
        messages=[{"role": "user", "content": "x"}],
        system_prompt="You are a bot",
        tools=tools,
    )

    call_kwargs = client._raw.messages.create.call_args[1]
    assert call_kwargs["system"] == "You are a bot"
    assert call_kwargs["tools"] == tools  # Anthropic format unchanged


def test_complete_anthropic_model_override() -> None:
    client = _make_anthropic_client()
    mock_raw = MagicMock(spec=anthropic.types.Message)
    mock_raw.stop_reason = "end_turn"
    mock_raw.content = []
    client._raw.messages.create.return_value = mock_raw

    complete(client, [], model="claude-override")

    call_kwargs = client._raw.messages.create.call_args[1]
    assert call_kwargs["model"] == "claude-override"


def test_complete_litellm_done() -> None:
    client = _make_litellm_client()
    mock_message = MagicMock()
    mock_message.content = "LiteLLM answer"
    mock_message.tool_calls = None
    mock_choice = MagicMock()
    mock_choice.finish_reason = "stop"
    mock_choice.message = mock_message
    mock_raw = MagicMock()
    mock_raw.choices = [mock_choice]
    client._raw.chat.completions.create.return_value = mock_raw

    response = complete(client, [{"role": "user", "content": "Hi"}])

    assert response.is_done is True
    assert response.text == "LiteLLM answer"
    assert response.tool_calls == []


def test_complete_litellm_tool_call() -> None:
    client = _make_litellm_client()
    mock_tc = MagicMock()
    mock_tc.id = "call_abc"
    mock_tc.function.name = "search"
    mock_tc.function.arguments = '{"query": "hello"}'
    mock_message = MagicMock()
    mock_message.content = None
    mock_message.tool_calls = [mock_tc]
    mock_choice = MagicMock()
    mock_choice.finish_reason = "tool_calls"
    mock_choice.message = mock_message
    mock_raw = MagicMock()
    mock_raw.choices = [mock_choice]
    client._raw.chat.completions.create.return_value = mock_raw

    response = complete(client, [{"role": "user", "content": "Search"}])

    assert response.is_done is False
    assert len(response.tool_calls) == 1
    assert response.tool_calls[0].id == "call_abc"
    assert response.tool_calls[0].name == "search"
    assert response.tool_calls[0].input == {"query": "hello"}


def test_complete_litellm_converts_tools() -> None:
    client = _make_litellm_client()
    mock_message = MagicMock()
    mock_message.content = "ok"
    mock_message.tool_calls = None
    mock_choice = MagicMock()
    mock_choice.finish_reason = "stop"
    mock_choice.message = mock_message
    mock_raw = MagicMock()
    mock_raw.choices = [mock_choice]
    client._raw.chat.completions.create.return_value = mock_raw

    tools = [{"name": "t", "description": "d", "input_schema": {"type": "object"}}]
    complete(client, [], tools=tools)

    call_kwargs = client._raw.chat.completions.create.call_args[1]
    assert call_kwargs["tools"][0]["type"] == "function"
    assert "parameters" in call_kwargs["tools"][0]["function"]
    assert "input_schema" not in call_kwargs["tools"][0]["function"]


def test_complete_litellm_prepends_system_prompt() -> None:
    client = _make_litellm_client()
    mock_message = MagicMock()
    mock_message.content = "ok"
    mock_message.tool_calls = None
    mock_choice = MagicMock()
    mock_choice.finish_reason = "stop"
    mock_choice.message = mock_message
    mock_raw = MagicMock()
    mock_raw.choices = [mock_choice]
    client._raw.chat.completions.create.return_value = mock_raw

    complete(client, [{"role": "user", "content": "hi"}], system_prompt="You are a bot")

    call_kwargs = client._raw.chat.completions.create.call_args[1]
    messages = call_kwargs["messages"]
    assert messages[0] == {"role": "system", "content": "You are a bot"}
    assert messages[1] == {"role": "user", "content": "hi"}
```

- [ ] **Step 2: Run tests to see them fail**

```bash
uv run pytest tests/test_llm.py -k "complete" -v
```

Expected: All FAIL with `NotImplementedError`

- [ ] **Step 3: Implement `complete` in `llm.py`**

Replace the stub:

```python
def complete(
    client: LLMClient,
    messages: list[dict],
    system_prompt: str = "",
    tools: list[dict] = [],
    max_tokens: int = 4096,
    model: str | None = None,
) -> LLMResponse:
    """Unified completion call. Returns a provider-agnostic LLMResponse."""
    effective_model = model or client.model

    if client.provider == "anthropic":
        kwargs: dict[str, Any] = {
            "model": effective_model,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if system_prompt:
            kwargs["system"] = system_prompt
        if tools:
            kwargs["tools"] = tools  # already in Anthropic format
        raw = client._raw.messages.create(**kwargs)
        is_done = raw.stop_reason == "end_turn"
        text = (
            " ".join(
                block.text for block in raw.content if hasattr(block, "text")
            )
            if is_done
            else ""
        )
        tool_calls = [
            ToolCall(id=block.id, name=block.name, input=block.input)
            for block in raw.content
            if block.type == "tool_use"
        ]
        return LLMResponse(is_done=is_done, text=text, tool_calls=tool_calls, _raw=raw)

    # litellm
    all_messages: list[dict] = []
    if system_prompt:
        all_messages.append({"role": "system", "content": system_prompt})
    all_messages.extend(messages)
    kwargs = {
        "model": effective_model,
        "max_tokens": max_tokens,
        "messages": all_messages,
    }
    if tools:
        kwargs["tools"] = _convert_tools(tools, "litellm")
    raw = client._raw.chat.completions.create(**kwargs)
    choice = raw.choices[0]
    is_done = choice.finish_reason == "stop"
    msg = choice.message
    text = (msg.content or "") if is_done else ""
    tool_calls = []
    if msg.tool_calls:
        for tc in msg.tool_calls:
            tool_calls.append(
                ToolCall(
                    id=tc.id,
                    name=tc.function.name,
                    input=json.loads(tc.function.arguments),
                )
            )
    return LLMResponse(is_done=is_done, text=text, tool_calls=tool_calls, _raw=raw)
```

- [ ] **Step 4: Run tests to see them pass**

```bash
uv run pytest tests/test_llm.py -k "complete" -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add llm.py tests/test_llm.py
git commit -m "feat: implement complete() with tests for both providers"
```

---

## Task 6: Implement `make_assistant_message` and `make_tool_result_messages`

**Files:**
- Modify: `llm.py`
- Modify: `tests/test_llm.py`

- [ ] **Step 1: Add message helper tests to `tests/test_llm.py`**

Append to `tests/test_llm.py`:

```python
# ---------------------------------------------------------------------------
# make_assistant_message
# ---------------------------------------------------------------------------

def test_make_assistant_message_anthropic() -> None:
    mock_content = [MagicMock(type="text", text="hello")]
    mock_raw = MagicMock(spec=anthropic.types.Message)
    mock_raw.content = mock_content
    response = LLMResponse(is_done=True, text="hello", tool_calls=[], _raw=mock_raw)

    msg = make_assistant_message(response)

    assert msg["role"] == "assistant"
    assert msg["content"] is mock_content


def test_make_assistant_message_litellm_no_tool_calls() -> None:
    mock_message = MagicMock()
    mock_message.content = "some answer"
    mock_message.tool_calls = None
    # Plain MagicMock is not isinstance(_, anthropic.types.Message) → takes OpenAI branch
    mock_raw = MagicMock()
    mock_raw.choices = [MagicMock(message=mock_message)]
    response = LLMResponse(is_done=True, text="some answer", tool_calls=[], _raw=mock_raw)

    msg = make_assistant_message(response)

    assert msg["role"] == "assistant"
    assert msg["content"] == "some answer"
    assert "tool_calls" not in msg


def test_make_assistant_message_litellm_with_tool_calls() -> None:
    mock_tc = MagicMock()
    mock_tc.id = "call_123"
    mock_tc.function.name = "my_tool"
    mock_tc.function.arguments = '{"x": 1}'
    mock_message = MagicMock()
    mock_message.content = None
    mock_message.tool_calls = [mock_tc]
    mock_raw = MagicMock()
    mock_raw.choices = [MagicMock(message=mock_message)]
    response = LLMResponse(is_done=False, text="", tool_calls=[], _raw=mock_raw)

    msg = make_assistant_message(response)

    assert msg["role"] == "assistant"
    assert len(msg["tool_calls"]) == 1
    assert msg["tool_calls"][0]["id"] == "call_123"
    assert msg["tool_calls"][0]["type"] == "function"
    assert msg["tool_calls"][0]["function"]["name"] == "my_tool"
    assert msg["tool_calls"][0]["function"]["arguments"] == '{"x": 1}'


# ---------------------------------------------------------------------------
# make_tool_result_messages
# ---------------------------------------------------------------------------

def test_make_tool_result_messages_anthropic() -> None:
    client = LLMClient(provider="anthropic", model="m", _raw=MagicMock())
    msgs = make_tool_result_messages(client, "toolu_01", "42")

    assert len(msgs) == 1
    assert msgs[0]["role"] == "user"
    assert len(msgs[0]["content"]) == 1
    block = msgs[0]["content"][0]
    assert block["type"] == "tool_result"
    assert block["tool_use_id"] == "toolu_01"
    assert block["content"] == "42"


def test_make_tool_result_messages_litellm() -> None:
    client = LLMClient(provider="litellm", model="m", _raw=MagicMock())
    msgs = make_tool_result_messages(client, "call_abc", "the result")

    assert len(msgs) == 1
    assert msgs[0]["role"] == "tool"
    assert msgs[0]["tool_call_id"] == "call_abc"
    assert msgs[0]["content"] == "the result"
```

- [ ] **Step 2: Run tests to see them fail**

```bash
uv run pytest tests/test_llm.py -k "make_assistant or make_tool_result" -v
```

Expected: All FAIL with `NotImplementedError`

- [ ] **Step 3: Implement `make_assistant_message` in `llm.py`**

Replace the stub:

```python
def make_assistant_message(response: LLMResponse) -> dict:
    """Build the assistant turn dict to append to the messages list."""
    raw = response._raw
    if isinstance(raw, anthropic.types.Message):
        return {"role": "assistant", "content": raw.content}
    # LiteLLM/OpenAI
    msg = raw.choices[0].message
    result: dict[str, Any] = {"role": "assistant", "content": msg.content}
    if msg.tool_calls:
        result["tool_calls"] = [
            {
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                },
            }
            for tc in msg.tool_calls
        ]
    return result
```

- [ ] **Step 4: Implement `make_tool_result_messages` in `llm.py`**

Replace the stub:

```python
def make_tool_result_messages(
    client: LLMClient, tool_call_id: str, result: str
) -> list[dict]:
    """Build tool result message(s) to extend onto the messages list."""
    if client.provider == "anthropic":
        return [
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_call_id,
                        "content": result,
                    }
                ],
            }
        ]
    return [
        {
            "role": "tool",
            "tool_call_id": tool_call_id,
            "content": result,
        }
    ]
```

- [ ] **Step 5: Run all `test_llm.py` tests to see them pass**

```bash
uv run pytest tests/test_llm.py -v
```

Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add llm.py tests/test_llm.py
git commit -m "feat: implement make_assistant_message and make_tool_result_messages with tests"
```

---

## Task 7: Update `agent.py`

**Files:**
- Modify: `agent.py`

Replace the four provider-specific touchpoints. `agent.py` currently:
- Line 19: `import anthropic`
- Line 28: `MODEL = "claude-opus-4-5"` constant
- Line 32: `client = anthropic.Anthropic()`
- Lines 254–261: `client.messages.create(model=MODEL, ...)`
- Line 266: `messages.append({"role": "assistant", "content": response.content})`
- Lines 269–276: `if response.stop_reason == "end_turn":` + text extraction
- Lines 280–329: tool loop using `response.content` blocks and `tool_results.append({...})`
- Line 332: `messages.append({"role": "user", "content": tool_results})`

- [ ] **Step 1: Update imports in `agent.py`**

Remove `import anthropic` (line 19) and add the `llm` import after the existing imports block. The top of the file should read:

```python
import os
import json
from pathlib import Path
from typing import Any

from llm import create_client, complete, make_assistant_message, make_tool_result_messages
from knowledge import KNOWLEDGE_TOOLS, handle_knowledge_tool, build_source_registry, KNOWLEDGE_ROOT
```

- [ ] **Step 2: Remove `MODEL` constant and update module-level `client`**

Remove lines:
```python
MODEL = "claude-opus-4-5"          # use the latest Opus; swap to sonnet for speed
```
and
```python
client = anthropic.Anthropic()     # reads ANTHROPIC_API_KEY from env
```

Replace the module-level client with a comment noting it is created per `run_agent` call (the `create_client()` call moves inside `run_agent`).

- [ ] **Step 3: Update `run_agent` — client creation**

At the top of `run_agent`, after building the registries (around line 204), add:

```python
client = create_client()
```

- [ ] **Step 4: Update `run_agent` — API call**

Replace:
```python
response = client.messages.create(
    model=MODEL,
    max_tokens=4096,
    system=system_prompt,
    tools=all_tools,
    messages=messages,
)
```

With:
```python
response = complete(client, messages, system_prompt=system_prompt, tools=all_tools)
```

- [ ] **Step 5: Update `run_agent` — stop check and text extraction**

Replace:
```python
# Append assistant turn
messages.append({"role": "assistant", "content": response.content})

# If no tool calls → done
if response.stop_reason == "end_turn":
    final = " ".join(
        block.text for block in response.content
        if hasattr(block, "text")
    )
    if verbose:
        print(f"\nFinal answer:\n{final}")
    return final
```

With:
```python
# Append assistant turn
messages.append(make_assistant_message(response))

# If no tool calls → done
if response.is_done:
    if verbose:
        print(f"\nFinal answer:\n{response.text}")
    return response.text
```

- [ ] **Step 6: Update `run_agent` — tool loop and results**

Replace the tool loop that iterates `response.content` blocks:
```python
# Process tool calls
tool_results = []
for block in response.content:
    if block.type != "tool_use":
        continue

    tool_name = block.name
    tool_input = block.input
    tool_use_id = block.id

    ...

    tool_results.append({
        "type": "tool_result",
        "tool_use_id": tool_use_id,
        "content": str(result),
    })

# Append user turn with all tool results
messages.append({"role": "user", "content": tool_results})
```

With:
```python
# Process tool calls
tool_results: list[dict] = []
for tool_call in response.tool_calls:
    tool_name = tool_call.name
    tool_input = tool_call.input
    tool_use_id = tool_call.id

    if verbose:
        print(f"\nTool call: {tool_name}")
        print(f"Input: {json.dumps(tool_input, indent=2)}")

    # Route to the appropriate handler
    if tool_name == "list_skills":
        result = list_skills(tool_input, registry)

    elif tool_name == "read_skill":
        result = read_skill(tool_input, registry)
        skill_name = tool_input.get("skill_name", "")
        if skill_name not in loaded_skills and skill_name in registry:
            new_tools = _parse_skill_tools(result)
            if new_tools:
                active_skill_tools.extend(new_tools)
                loaded_skills.add(skill_name)
                if verbose:
                    print(f"Unlocked tools from '{skill_name}': "
                          f"{[t['name'] for t in new_tools]}")

    elif tool_name == "read_knowledge":
        result = handle_knowledge_tool(tool_name, tool_input, source_registry)

    elif tool_name in SKILL_TOOL_HANDLERS:
        try:
            result = SKILL_TOOL_HANDLERS[tool_name](tool_input)
        except Exception as e:
            result = f"Error executing {tool_name}: {e}"

    else:
        result = f"Error: unknown tool '{tool_name}'"

    if verbose:
        preview = str(result)[:300]
        print(f"Result preview: {preview}{'...' if len(str(result)) > 300 else ''}")

    tool_results.extend(make_tool_result_messages(client, tool_use_id, str(result)))

# Extend messages with all tool results
messages.extend(tool_results)
```

- [ ] **Step 7: Verify `agent.py` imports cleanly**

```bash
uv run python -c "import agent; print('ok')"
```

Expected: `ok`

- [ ] **Step 8: Commit**

```bash
git add agent.py
git commit -m "feat: update agent.py to use llm.py adapter"
```

---

## Task 8: Update `enrich_knowledge.py` and fix its tests

**Files:**
- Modify: `enrich_knowledge.py`
- Modify: `tests/test_enrich_knowledge.py`

The current `enrich_knowledge.py` uses `anthropic.Anthropic()` directly and `client.messages.create(...)`. We swap these for `create_client()` and `complete()`. Four tests in `test_enrich_knowledge.py` mock the old SDK interface and must be updated.

- [ ] **Step 1: Update imports in `enrich_knowledge.py`**

Remove:
```python
import anthropic
```

Add (after `import argparse` and `import sys`):
```python
from llm import LLMClient, create_client, complete
```

- [ ] **Step 2: Update `enrich_file` signature**

Change the type annotation on `client`:

```python
def enrich_file(
    path: Path, client: LLMClient | None, dry_run: bool = False
) -> bool:
```

- [ ] **Step 3: Update the API call inside `enrich_file`**

Replace:
```python
response = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=512,
    messages=[{"role": "user", "content": prompt}],
)

raw = response.content[0].text.strip()
```

With:
```python
response = complete(
    client,
    messages=[{"role": "user", "content": prompt}],
    max_tokens=512,
    model="claude-haiku-4-5-20251001",
)

raw = response.text.strip()
```

- [ ] **Step 4: Update `run_phase1` — client creation**

Replace:
```python
client = anthropic.Anthropic() if not dry_run else None
```

With:
```python
client = create_client() if not dry_run else None
```

- [ ] **Step 5: Verify `enrich_knowledge.py` imports cleanly**

```bash
uv run python -c "import enrich_knowledge; print('ok')"
```

Expected: `ok`

- [ ] **Step 6: Update the four SDK-dependent tests in `tests/test_enrich_knowledge.py`**

The four tests that mocked `client.messages.create` must now mock `enrich_knowledge.complete`.

Replace `test_enrich_file_skips_already_enriched`:
```python
@patch("enrich_knowledge.complete")
def test_enrich_file_skips_already_enriched(mock_complete: MagicMock, tmp_path: Path) -> None:
    p = tmp_path / "index.md"
    p.write_text(
        "---\ntitle: Test\nsummary: Already there.\ntopics:\n- t\nkeywords:\n- k\n---\nContent."
    )
    mock_client = MagicMock()
    result = enrich_file(p, mock_client)
    assert result is False
    mock_complete.assert_not_called()
```

Replace `test_enrich_file_calls_claude_and_writes_fields`:
```python
@patch("enrich_knowledge.complete")
def test_enrich_file_calls_claude_and_writes_fields(mock_complete: MagicMock, tmp_path: Path) -> None:
    p = tmp_path / "index.md"
    p.write_text("---\ntitle: Test Page\n---\nSome content about insurance.")

    mock_complete.return_value = MagicMock(
        text=textwrap.dedent("""\
            summary: "A page about insurance."
            topics:
              - insurance
            keywords:
              - cover
        """)
    )
    mock_client = MagicMock()

    result = enrich_file(p, mock_client)

    assert result is True
    mock_complete.assert_called_once()
    fm, _ = parse_frontmatter(p.read_text())
    assert fm["summary"] == "A page about insurance."
    assert "insurance" in fm["topics"]
    assert "cover" in fm["keywords"]
```

Replace `test_enrich_file_strips_markdown_code_fences`:
```python
@patch("enrich_knowledge.complete")
def test_enrich_file_strips_markdown_code_fences(mock_complete: MagicMock, tmp_path: Path) -> None:
    p = tmp_path / "index.md"
    p.write_text("---\ntitle: Test Page\n---\nSome content.")

    mock_complete.return_value = MagicMock(
        text=textwrap.dedent("""\
            ```yaml
            summary: "A page about insurance."
            topics:
              - insurance
            keywords:
              - cover
            ```
        """)
    )
    mock_client = MagicMock()

    result = enrich_file(p, mock_client)

    assert result is True
    fm, _ = parse_frontmatter(p.read_text())
    assert fm["summary"] == "A page about insurance."
    assert "insurance" in fm["topics"]
```

Replace `test_enrich_file_dry_run_does_not_write`:
```python
@patch("enrich_knowledge.complete")
def test_enrich_file_dry_run_does_not_write(mock_complete: MagicMock, tmp_path: Path) -> None:
    p = tmp_path / "index.md"
    original = "---\ntitle: Test\n---\nContent."
    p.write_text(original)

    enrich_file(p, MagicMock(), dry_run=True)
    assert p.read_text() == original
    mock_complete.assert_not_called()
```

Also add `from unittest.mock import patch` to the imports in `test_enrich_knowledge.py` (it already imports `MagicMock, patch` — verify `patch` is in the import).

- [ ] **Step 7: Run all tests**

```bash
uv run pytest -v
```

Expected: All tests PASS. No failures, no errors.

- [ ] **Step 8: Commit**

```bash
git add enrich_knowledge.py tests/test_enrich_knowledge.py
git commit -m "feat: update enrich_knowledge.py to use llm.py adapter"
```
