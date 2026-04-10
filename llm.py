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
    if provider != "litellm":
        return tools
    result = []
    for tool in tools:
        fn = {k: v for k, v in tool.items() if k != "input_schema"}
        if "input_schema" in tool:
            fn["parameters"] = tool["input_schema"]
        result.append({"type": "function", "function": fn})
    return result


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


def complete(
    client: LLMClient,
    messages: list[dict],
    system_prompt: str = "",
    tools: list[dict] | None = None,
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
                block.text for block in raw.content if block.type == "text"
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
    # finish_reason "length" (truncation) or other values → is_done=False, text=""
    # SDK exceptions propagate unchanged per spec
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
