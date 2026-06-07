"""Tests for backend.utils.config module."""
import os
from unittest.mock import patch

import pytest
from backend.utils.config import validate_llm_config


class TestValidateLlmConfig:
    """Tests for validate_llm_config function."""
    
    def test_raises_when_no_provider(self) -> None:
        """Raises ValueError when provider not in env or params."""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="LLM_PROVIDER.*not set"):
                validate_llm_config()
    
    def test_raises_when_provider_invalid(self) -> None:
        """Raises ValueError when provider is not 'anthropic' or 'litellm'."""
        with pytest.raises(ValueError, match="Invalid LLM_PROVIDER.*openai"):
            validate_llm_config(provider="openai", model="gpt-4", api_key="key")
    
    def test_raises_when_no_model(self) -> None:
        """Raises ValueError when model not in env or params."""
        with patch.dict(os.environ, {"LLM_PROVIDER": "anthropic"}, clear=True):
            with pytest.raises(ValueError, match="LLM_MODEL.*not set"):
                validate_llm_config()
    
    def test_raises_when_anthropic_provider_missing_api_key(self) -> None:
        """Raises ValueError when anthropic provider has no API key."""
        with patch.dict(
            os.environ,
            {"LLM_PROVIDER": "anthropic", "LLM_MODEL": "claude-3-opus"},
            clear=True,
        ):
            with pytest.raises(ValueError, match="ANTHROPIC_API_KEY.*not set"):
                validate_llm_config()
    
    def test_litellm_provider_allows_missing_api_key(self) -> None:
        """LiteLLM provider does not require API key (optional for some providers)."""
        with patch.dict(
            os.environ,
            {"LLM_PROVIDER": "litellm", "LLM_MODEL": "ollama/llama2"},
            clear=True,
        ):
            provider, model, api_key = validate_llm_config()
            assert provider == "litellm"
            assert model == "ollama/llama2"
            assert api_key == ""
    
    def test_reads_from_environment_when_no_params(self) -> None:
        """Reads all config from environment variables when params are None."""
        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "anthropic",
                "LLM_MODEL": "claude-3-sonnet",
                "ANTHROPIC_API_KEY": "sk-ant-test123",
            },
            clear=True,
        ):
            provider, model, api_key = validate_llm_config()
            assert provider == "anthropic"
            assert model == "claude-3-sonnet"
            assert api_key == "sk-ant-test123"
    
    def test_explicit_params_override_environment(self) -> None:
        """Explicit parameters override environment variables."""
        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "anthropic",
                "LLM_MODEL": "claude-3-opus",
                "ANTHROPIC_API_KEY": "sk-ant-env",
            },
            clear=True,
        ):
            provider, model, api_key = validate_llm_config(
                provider="litellm",
                model="gpt-4",
                api_key="sk-override",
            )
            assert provider == "litellm"
            assert model == "gpt-4"
            assert api_key == "sk-override"
    
    def test_partial_override_reads_remaining_from_env(self) -> None:
        """Overriding some params still reads others from env."""
        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "anthropic",
                "LLM_MODEL": "claude-3-haiku",
                "ANTHROPIC_API_KEY": "sk-ant-env",
            },
            clear=True,
        ):
            provider, model, api_key = validate_llm_config(model="claude-3-sonnet")
            assert provider == "anthropic"  # from env
            assert model == "claude-3-sonnet"  # overridden
            assert api_key == "sk-ant-env"  # from env
    
    def test_empty_string_provider_treated_as_missing(self) -> None:
        """Empty string for provider is treated as missing, reads from env."""
        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "anthropic",
                "LLM_MODEL": "claude-3-opus",
                "ANTHROPIC_API_KEY": "sk-ant-test",
            },
            clear=True,
        ):
            provider, model, api_key = validate_llm_config(provider="")
            # Empty string is falsy, so falls back to env
            assert provider == "anthropic"
    
    def test_empty_string_model_treated_as_missing(self) -> None:
        """Empty string for model is treated as missing, reads from env."""
        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "anthropic",
                "LLM_MODEL": "claude-3-sonnet",
                "ANTHROPIC_API_KEY": "sk-ant-test",
            },
            clear=True,
        ):
            provider, model, api_key = validate_llm_config(model="")
            assert model == "claude-3-sonnet"
    
    def test_empty_string_api_key_treated_as_missing(self) -> None:
        """Empty string for api_key is treated as missing, reads from env."""
        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "anthropic",
                "LLM_MODEL": "claude-3-opus",
                "ANTHROPIC_API_KEY": "sk-ant-env",
            },
            clear=True,
        ):
            provider, model, api_key = validate_llm_config(api_key="")
            assert api_key == "sk-ant-env"
    
    def test_litellm_reads_litellm_api_key_env_var(self) -> None:
        """LiteLLM provider reads LITELLM_API_KEY from environment."""
        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "litellm",
                "LLM_MODEL": "gpt-4",
                "LITELLM_API_KEY": "sk-litellm-test",
            },
            clear=True,
        ):
            provider, model, api_key = validate_llm_config()
            assert provider == "litellm"
            assert api_key == "sk-litellm-test"
    
    def test_anthropic_ignores_litellm_api_key(self) -> None:
        """Anthropic provider does not use LITELLM_API_KEY."""
        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "anthropic",
                "LLM_MODEL": "claude-3-opus",
                "LITELLM_API_KEY": "sk-litellm-wrong",
            },
            clear=True,
        ):
            with pytest.raises(ValueError, match="ANTHROPIC_API_KEY.*not set"):
                validate_llm_config()
    
    def test_multiple_api_keys_set_uses_correct_one(self) -> None:
        """When both API keys set, uses the one matching provider."""
        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "anthropic",
                "LLM_MODEL": "claude-3-opus",
                "ANTHROPIC_API_KEY": "sk-ant-correct",
                "LITELLM_API_KEY": "sk-litellm-wrong",
            },
            clear=True,
        ):
            provider, model, api_key = validate_llm_config()
            assert api_key == "sk-ant-correct"
        
        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "litellm",
                "LLM_MODEL": "gpt-4",
                "ANTHROPIC_API_KEY": "sk-ant-wrong",
                "LITELLM_API_KEY": "sk-litellm-correct",
            },
            clear=True,
        ):
            provider, model, api_key = validate_llm_config()
            assert api_key == "sk-litellm-correct"
    
    def test_returns_tuple_in_correct_order(self) -> None:
        """Returns (provider, model, api_key) tuple in correct order."""
        with patch.dict(
            os.environ,
            {
                "LLM_PROVIDER": "anthropic",
                "LLM_MODEL": "claude-3-opus",
                "ANTHROPIC_API_KEY": "sk-ant-123",
            },
            clear=True,
        ):
            result = validate_llm_config()
            assert isinstance(result, tuple)
            assert len(result) == 3
            provider, model, api_key = result
            assert provider == "anthropic"
            assert model == "claude-3-opus"
            assert api_key == "sk-ant-123"
