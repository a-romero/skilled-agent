"""
DSPy ReAct Agent
================
A DSPy-based ReAct agent that mirrors the knowledge-access pattern of agent.py
but uses dspy.ReAct for the reasoning loop.

The agent:
  1. Uses search_knowledge_graph to find relevant knowledge pages, falling back to
     read_knowledge / SUMMARY.MD navigation when the graph is unavailable
  2. Answers queries about Aviva's products/services with proper source citations
  3. Traces every run to Arize via the DSPy OpenInference instrumentor
     (same SSL/endpoint workaround as agent.py)

Usage:
    uv run python dspy_agent.py "What is group life insurance?"
"""

import os
import threading
from typing import Callable
from dotenv import load_dotenv
from pathlib import Path

import dspy

from knowledge import KNOWLEDGE_ROOT, build_source_registry, read_knowledge
from arize_tracing import setup_arize, instrument_dspy, get_tracer
from skills import build_skill_registry, list_skills, read_skill
from knowledge_graph import KnowledgeGraph as _KGClass

load_dotenv()

SKILLS_ROOT = Path("./skills")

# ---------------------------------------------------------------------------
# Knowledge base setup
# ---------------------------------------------------------------------------

_SOURCE_REGISTRY: dict = {}
_SOURCE_REGISTRY_LOCK = threading.Lock()


def _get_source_registry() -> dict:
    """Lazily build and cache the source registry."""
    global _SOURCE_REGISTRY
    if not _SOURCE_REGISTRY:
        with _SOURCE_REGISTRY_LOCK:
            if not _SOURCE_REGISTRY:
                _SOURCE_REGISTRY = build_source_registry(KNOWLEDGE_ROOT / "README.md")
    return _SOURCE_REGISTRY


_KNOWLEDGE_GRAPH: _KGClass | None = None
_KNOWLEDGE_GRAPH_LOCK = threading.Lock()


def _get_knowledge_graph() -> _KGClass:
    """Lazily instantiate and cache the KnowledgeGraph."""
    global _KNOWLEDGE_GRAPH
    if _KNOWLEDGE_GRAPH is None:
        with _KNOWLEDGE_GRAPH_LOCK:
            if _KNOWLEDGE_GRAPH is None:
                _KNOWLEDGE_GRAPH = _KGClass()
                if not _KNOWLEDGE_GRAPH.available:
                    import warnings
                    warnings.warn(
                        "Knowledge graph not available — run: uv run python enrich_knowledge.py",
                        stacklevel=2,
                    )
    return _KNOWLEDGE_GRAPH


def _load_knowledge_index() -> str:
    """Read the top-level SUMMARY.MD as the navigation index."""
    summary_path = KNOWLEDGE_ROOT / "SUMMARY.MD"
    if not summary_path.exists():
        raise FileNotFoundError(
            f"{summary_path} not found. Run: uv run python enrich_knowledge.py"
        )
    return summary_path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Skill tools factory
# ---------------------------------------------------------------------------

def _make_skill_tools(
    registry: dict,
    event_callback: Callable[[dict], None] | None = None,
) -> tuple[Callable, Callable]:
    """Build list_skills and read_skill tool closures with optional event instrumentation.

    Args:
        registry: Skill registry built by build_skill_registry.
        event_callback: Optional callable fired before each tool returns.
            list_skills fires {"kind": "skill_list"}.
            read_skill fires {"kind": "skill_read", "name": ..., "desc": ...}.

    Returns:
        (list_skills_tool, read_skill_tool) closures ready for dspy.ReAct.
    """

    def list_skills_tool() -> str:
        """List all available skills with their one-line descriptions.
        Call this first to discover what capabilities are available before
        deciding which skill to load."""
        if event_callback:
            event_callback({"kind": "skill_list"})
        return list_skills({}, registry)

    def read_skill_tool(skill_name: str) -> str:
        """Read the full SKILL.md for a named skill. Only call when you have
        determined the skill is relevant. The file contains instructions and
        examples.

        Args:
            skill_name: Exact skill name as returned by list_skills_tool.
        """
        if event_callback:
            event_callback({
                "kind": "skill_read",
                "name": skill_name,
                "desc": registry.get(skill_name, {}).get("description", ""),
            })
        return read_skill({"skill_name": skill_name}, registry)

    return list_skills_tool, read_skill_tool


# ---------------------------------------------------------------------------
# Tool exposed to the ReAct agent
# ---------------------------------------------------------------------------

def read_knowledge_tool(path: str) -> str:
    """Read a file from the Aviva knowledge base.

    Navigate using SUMMARY.MD files at each directory level to discover
    available sections and pages (e.g. 'business/SUMMARY.MD').
    Once you have identified the relevant page, read its index.md for the
    full content (e.g. 'business/group-protection/group-life-insurance/index.md').

    Args:
        path: Relative path from the knowledge root.
              Examples: 'SUMMARY.MD', 'business/SUMMARY.MD',
              'business/group-protection/group-life-insurance/index.md'

    Returns:
        File content, prefixed with source metadata for index.md pages.
    """
    return read_knowledge({"path": path}, _get_source_registry(), KNOWLEDGE_ROOT)


def search_knowledge_graph_tool(query: str, section: str = "") -> str:
    """Search the knowledge graph for pages relevant to a query.

    Returns the top 5 most relevant pages with their path, title, and summary.
    Use this as your primary navigation method instead of reading SUMMARY.MD files.
    Provide a section to scope the search when the topic domain is clear.

    Available sections: business, health, health-insurance, health-providers,
    help-and-support, insurance, investments, retirement, risksolutions, services.
    Leave section empty to search globally.

    Args:
        query: Natural language query describing what you are looking for.
        section: Optional top-level section to scope the search.

    Returns:
        JSON list of up to 5 results, each with path, title, and summary.
        Returns "[]" if the graph is unavailable or no results match.
    """
    import json
    kg = _get_knowledge_graph()
    if not kg.available:
        return json.dumps([])
    results = kg.search(query, section=section or None)
    return json.dumps(results, indent=2)


# ---------------------------------------------------------------------------
# DSPy configuration
# ---------------------------------------------------------------------------

def _build_lm() -> dspy.LM:
    """Build a DSPy LM from environment variables."""
    provider = os.environ.get("LLM_PROVIDER", "")
    model = os.environ.get("LLM_MODEL", "")

    if not provider:
        raise ValueError("LLM_PROVIDER env var not set")
    if not model:
        raise ValueError("LLM_MODEL env var not set")

    if provider == "anthropic":
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY env var not set")
        return dspy.LM(f"anthropic/{model}", api_key=api_key)

    if provider == "litellm":
        base_url = os.environ.get("LITELLM_BASE_URL", "")
        api_key = os.environ.get("LITELLM_API_KEY", "openai")
        # DSPy uses LiteLLM under the hood; route through a custom proxy
        return dspy.LM(
            f"openai/{model}",
            api_base=base_url or None,
            api_key=api_key,
        )

    raise ValueError(f"Unknown LLM_PROVIDER: {provider!r}")


# ---------------------------------------------------------------------------
# ReAct agent definition
# ---------------------------------------------------------------------------

class KnowledgeAgentSignature(dspy.Signature):
    """Answer customer queries about Aviva's products and services.

    You have access to a skill library and a knowledge base.

    Skills:
    1. Call list_skills_tool to discover available skills and their descriptions.
    2. Call read_skill_tool with a skill name only if you have determined it is relevant.

    Knowledge base:
    3. Use search_knowledge_graph_tool as your primary navigation method:
       - Call it with the user's query and a section if the domain is clear.
       - Review the returned titles and summaries to pick the 1-2 most relevant pages.
       - Call read_knowledge to retrieve full content from those paths.
    4. Only fall back to SUMMARY.MD navigation via read_knowledge if search returns no results.
    5. Always cite sources (title and URL) at the end of your answer.

    Format your sources section as:
    ## Sources
    - [Page Title](https://url)
    """

    knowledge_index: str = dspy.InputField(
        desc="Top-level knowledge index (SUMMARY.MD) for fallback navigation"
    )
    question: str = dspy.InputField(desc="Customer question to answer")
    answer: str = dspy.OutputField(
        desc="Complete answer with ## Sources section listing every page read"
    )


class DSPyKnowledgeAgent(dspy.Module):
    """ReAct agent that answers Aviva product queries from the knowledge base."""

    def __init__(self, max_iters: int = 10, tools: list | None = None) -> None:
        self.react = dspy.ReAct(
            signature=KnowledgeAgentSignature,
            tools=tools if tools is not None else [read_knowledge_tool],
            max_iters=max_iters,
        )

    def forward(self, question: str, knowledge_index: str) -> dspy.Prediction:
        """Run the ReAct loop for a given question."""
        return self.react(question=question, knowledge_index=knowledge_index)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_agent(
    task: str,
    verbose: bool = True,
    event_callback: Callable[[dict], None] | None = None,
) -> str:
    """Run the DSPy ReAct agent for a given task. Returns the final answer.

    Args:
        task: The question or task to answer.
        verbose: Whether to print progress to stdout.
        event_callback: Optional callable invoked with event dicts as the agent
            works.  Events match the frontend protocol:
              {"kind": "read",  "path": "..."}
              {"kind": "think", "text": "..."}
    """

    lm = _build_lm()

    skill_registry = build_skill_registry(SKILLS_ROOT)

    list_skills_tool, read_skill_tool = _make_skill_tools(skill_registry, event_callback)

    knowledge_index = _load_knowledge_index()

    # Set up Arize tracing — DSPy instrumentor covers all LM calls automatically
    tracer_provider = setup_arize(
        project_name=os.getenv("ARIZE_PROJECT_NAME", "dspy-skilled-agent")
    )
    instrument_dspy(tracer_provider)
    tracer = get_tracer(tracer_provider, __name__)

    # Build instrumented tools that fire events before each call
    def _instrumented_read(path: str) -> str:
        if event_callback:
            event_callback({"kind": "read", "path": path})
        return read_knowledge_tool(path)

    _instrumented_read.__doc__ = read_knowledge_tool.__doc__

    def _instrumented_search(query: str, section: str = "") -> str:
        if event_callback:
            event_callback({"kind": "search", "query": query, "section": section})
        return search_knowledge_graph_tool(query, section)

    _instrumented_search.__doc__ = search_knowledge_graph_tool.__doc__

    agent = DSPyKnowledgeAgent(
        max_iters=10,
        tools=[list_skills_tool, read_skill_tool, _instrumented_search, _instrumented_read],
    )

    if verbose:
        print(f"Task: {task}\n")

    # Use dspy.context so each background thread gets its own LM config
    # rather than mutating global settings (which DSPy restricts to the
    # thread that first called dspy.configure).
    with dspy.context(lm=lm), tracer.start_as_current_span("agent") as agent_span:
        from opentelemetry.trace import Status, StatusCode

        agent_span.set_attribute("openinference.span.kind", "AGENT")
        agent_span.set_attribute("input.value", task)

        try:
            result = agent(question=task, knowledge_index=knowledge_index)
            answer: str = result.answer or ""
            agent_span.set_attribute("output.value", answer)
            agent_span.set_status(Status(StatusCode.OK))
        except Exception as exc:
            answer = f"Error: {exc}"
            agent_span.set_attribute("output.value", answer)
            agent_span.set_status(Status(StatusCode.ERROR, str(exc)))
            if verbose:
                raise

    if verbose:
        print(f"\n{'='*60}\nFinal answer:\n{answer}")

    return answer


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else (
        "What is group life insurance and what does Aviva offer?"
    )

    answer = run_agent(task)
    print(f"\n{'='*60}\nDone.")
