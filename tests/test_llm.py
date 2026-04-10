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
