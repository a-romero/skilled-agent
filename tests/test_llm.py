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
