"""Environment variable validation utilities."""
import logging
import os

logger = logging.getLogger(__name__)


def validate_llm_config(
    provider: str | None = None,
    model: str | None = None,
    api_key: str | None = None,
) -> tuple[str, str, str]:
    """Validate LLM configuration from environment or parameters.
    
    Args:
        provider: LLM provider ('anthropic' or 'litellm'), or None to read from env
        model: Model name, or None to read from env
        api_key: API key, or None to read from env
    
    Returns:
        Tuple of (provider, model, api_key)
    
    Raises:
        ValueError: If required configuration is missing or invalid
    """
    # Validate provider
    provider = provider or os.environ.get("LLM_PROVIDER")
    if not provider:
        raise ValueError(
            "LLM_PROVIDER environment variable not set and no explicit provider passed"
        )
    if provider not in ("anthropic", "litellm"):
        raise ValueError(
            f"Invalid LLM_PROVIDER: {provider!r}. Must be 'anthropic' or 'litellm'"
        )
    
    # Validate model
    model = model or os.environ.get("LLM_MODEL")
    if not model:
        raise ValueError(
            "LLM_MODEL environment variable not set and no explicit model passed"
        )
    
    # Validate API key based on provider
    if provider == "anthropic":
        api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY environment variable not set and no explicit api_key passed"
            )
    elif provider == "litellm":
        api_key = api_key or os.environ.get("LITELLM_API_KEY")
        # LiteLLM API key is optional for some providers
    
    logger.debug(f"LLM config validated: provider={provider}, model={model}")
    return (provider, model, api_key or "")
