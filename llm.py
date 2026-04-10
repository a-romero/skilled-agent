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
