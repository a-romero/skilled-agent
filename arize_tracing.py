"""
Centralized Arize tracing initialization for Jointly Studio.

Each agent gets its own Arize project (project_name = agent_id). Providers are
created on first use and cached so subsequent calls for the same agent_id are free.

Instrumentors (DSPy, LiteLLM, OpenAI Agents) patch the underlying libraries
globally and can only be applied once — they are registered with the first provider
created for their respective adapter type.

Usage:
    from arize_tracing import setup_arize, instrument_litellm

    tracer_provider = setup_arize(project_name="skilled-agent")
    instrument_litellm(tracer_provider)   # no-op after first call
"""

import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Enable tracing via ARIZE_TRACING_ENABLED=true (or 1/yes)
_ARIZE_TRACING_ENABLED: bool = os.getenv("ARIZE_TRACING_ENABLED", "false").lower() in (
    "1", "true", "yes"
)

# Cache of tracer providers keyed by project_name
_providers: Dict[str, Any] = {}

# Guard flags — instrumentors wrap libraries globally, so we only apply them once
_litellm_instrumented: bool = False
_dspy_instrumented: bool = False
_openai_agents_instrumented: bool = False


def setup_arize(project_name: str) -> Optional[Any]:
    """
    Return the cached tracer provider for *project_name*, creating it on first call.

    Returns None if tracing is disabled or credentials are missing.
    """
    if not _ARIZE_TRACING_ENABLED:
        return None

    if project_name in _providers:
        return _providers[project_name]

    api_key = os.getenv("ARIZE_API_KEY", "")
    space_id = os.getenv("ARIZE_SPACE_ID", "")

    if not api_key:
        logger.warning("Arize tracing disabled: ARIZE_API_KEY is not set")
        return None
    if not space_id:
        logger.warning("Arize tracing disabled: ARIZE_SPACE_ID is not set")
        return None

    try:
        import requests
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        _orig_send = requests.Session.send
        def _send_no_verify(self, request, **kwargs):  # type: ignore[override]
            kwargs["verify"] = False
            return _orig_send(self, request, **kwargs)
        requests.Session.send = _send_no_verify  # type: ignore[method-assign]

        from arize.otel import register, Transport

        tracer_provider = register(
            space_id=space_id,
            api_key=api_key,
            project_name=project_name,
            endpoint="https://otlp.eu-west-1a.arize.com/v1/traces",
            transport=Transport.HTTP,
        )
        _providers[project_name] = tracer_provider
        logger.info(f"Arize tracing initialized for project: {project_name}")
        return tracer_provider

    except ImportError:
        logger.warning(
            "arize-otel package not available — Arize tracing disabled. "
            "Install with: pip install arize-otel"
        )
        return None
    except Exception as e:
        logger.error(f"Failed to initialize Arize tracing for project '{project_name}': {e}")
        return None


def instrument_litellm(tracer_provider: Optional[Any]) -> None:
    """
    Apply the LiteLLM OpenInference instrumentor.

    No-op after the first successful call — the instrumentor patches the litellm
    library globally and must not be applied more than once.
    """
    global _litellm_instrumented
    if tracer_provider is None or _litellm_instrumented:
        return

    try:
        from openinference.instrumentation.litellm import LiteLLMInstrumentor
        LiteLLMInstrumentor().instrument(tracer_provider=tracer_provider)
        logger.info("LiteLLMInstrumentor applied")
        _litellm_instrumented = True
    except ImportError:
        logger.warning(
            "openinference-instrumentation-litellm not available. "
            "Install with: pip install openinference-instrumentation-litellm"
        )


def instrument_dspy(tracer_provider: Optional[Any]) -> None:
    """
    Apply DSPy and LiteLLM OpenInference instrumentors.

    No-op after the first successful call — instrumentors patch the library
    globally and must not be applied more than once.
    """
    global _dspy_instrumented
    if tracer_provider is None or _dspy_instrumented:
        return

    try:
        from openinference.instrumentation.dspy import DSPyInstrumentor
        DSPyInstrumentor().instrument(tracer_provider=tracer_provider)
        logger.info("DSPyInstrumentor applied")
    except ImportError:
        logger.warning(
            "openinference-instrumentation-dspy not available. "
            "Install with: pip install openinference-instrumentation-dspy"
        )

    instrument_litellm(tracer_provider)
    _dspy_instrumented = True


def instrument_openai_agents(tracer_provider: Optional[Any]) -> None:
    """
    Apply OpenAI Agents SDK OpenInference instrumentor.

    No-op after the first successful call.
    """
    global _openai_agents_instrumented
    if tracer_provider is None or _openai_agents_instrumented:
        return

    try:
        from openinference.instrumentation.openai_agents import OpenAIAgentsInstrumentor
        OpenAIAgentsInstrumentor().instrument(tracer_provider=tracer_provider)
        logger.info("OpenAIAgentsInstrumentor applied")
        _openai_agents_instrumented = True
    except ImportError:
        logger.warning(
            "openinference-instrumentation-openai-agents not available. "
            "Install with: pip install openinference-instrumentation-openai-agents"
        )
