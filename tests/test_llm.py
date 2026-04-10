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
    assert client._raw == {"api_base": "http://localhost:4000", "api_key": "test-key"}


# ---------------------------------------------------------------------------
# complete
# ---------------------------------------------------------------------------

def _make_anthropic_client() -> LLMClient:
    return LLMClient(provider="anthropic", model="claude-test", _raw=MagicMock())


def _make_litellm_client() -> LLMClient:
    return LLMClient(provider="litellm", model="gpt-test", _raw={"api_base": "http://localhost:4000", "api_key": "test-key"})


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

    call_kwargs = client._raw.messages.create.call_args.kwargs
    assert call_kwargs["system"] == "You are a bot"
    assert call_kwargs["tools"] == tools  # Anthropic format unchanged


def test_complete_anthropic_model_override() -> None:
    client = _make_anthropic_client()
    mock_raw = MagicMock(spec=anthropic.types.Message)
    mock_raw.stop_reason = "end_turn"
    mock_raw.content = []
    client._raw.messages.create.return_value = mock_raw

    complete(client, [], model="claude-override")

    call_kwargs = client._raw.messages.create.call_args.kwargs
    assert call_kwargs["model"] == "claude-override"


@patch("llm.litellm.completion")
def test_complete_litellm_done(mock_completion: MagicMock) -> None:
    client = _make_litellm_client()
    mock_message = MagicMock()
    mock_message.content = "LiteLLM answer"
    mock_message.tool_calls = None
    mock_choice = MagicMock()
    mock_choice.finish_reason = "stop"
    mock_choice.message = mock_message
    mock_raw = MagicMock()
    mock_raw.choices = [mock_choice]
    mock_completion.return_value = mock_raw

    response = complete(client, [{"role": "user", "content": "Hi"}])

    assert response.is_done is True
    assert response.text == "LiteLLM answer"
    assert response.tool_calls == []


@patch("llm.litellm.completion")
def test_complete_litellm_tool_call(mock_completion: MagicMock) -> None:
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
    mock_completion.return_value = mock_raw

    response = complete(client, [{"role": "user", "content": "Search"}])

    assert response.is_done is False
    assert len(response.tool_calls) == 1
    assert response.tool_calls[0].id == "call_abc"
    assert response.tool_calls[0].name == "search"
    assert response.tool_calls[0].input == {"query": "hello"}


@patch("llm.litellm.completion")
def test_complete_litellm_converts_tools(mock_completion: MagicMock) -> None:
    client = _make_litellm_client()
    mock_message = MagicMock()
    mock_message.content = "ok"
    mock_message.tool_calls = None
    mock_choice = MagicMock()
    mock_choice.finish_reason = "stop"
    mock_choice.message = mock_message
    mock_raw = MagicMock()
    mock_raw.choices = [mock_choice]
    mock_completion.return_value = mock_raw

    tools = [{"name": "t", "description": "d", "input_schema": {"type": "object"}}]
    complete(client, [], tools=tools)

    call_kwargs = mock_completion.call_args.kwargs
    assert call_kwargs["tools"][0]["type"] == "function"
    assert "parameters" in call_kwargs["tools"][0]["function"]
    assert "input_schema" not in call_kwargs["tools"][0]["function"]


@patch("llm.litellm.completion")
def test_complete_litellm_prepends_system_prompt(mock_completion: MagicMock) -> None:
    client = _make_litellm_client()
    mock_message = MagicMock()
    mock_message.content = "ok"
    mock_message.tool_calls = None
    mock_choice = MagicMock()
    mock_choice.finish_reason = "stop"
    mock_choice.message = mock_message
    mock_raw = MagicMock()
    mock_raw.choices = [mock_choice]
    mock_completion.return_value = mock_raw

    complete(client, [{"role": "user", "content": "hi"}], system_prompt="You are a bot")

    call_kwargs = mock_completion.call_args.kwargs
    messages = call_kwargs["messages"]
    assert messages[0] == {"role": "system", "content": "You are a bot"}
    assert messages[1] == {"role": "user", "content": "hi"}


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


def test_create_client_raises_if_anthropic_api_key_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("LLM_MODEL", "claude-test")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
        create_client()
