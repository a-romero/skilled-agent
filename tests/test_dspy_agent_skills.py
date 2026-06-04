import json
import textwrap
import pytest
from pathlib import Path
from unittest.mock import patch


SKILL_MD = textwrap.dedent("""\
    ---
    name: summariser
    description: "Summarise long texts into bullet points."
    ---

    # Summariser Skill

    Use this to condense content.
""")


@pytest.fixture
def skills_root(tmp_path: Path) -> Path:
    skill_dir = tmp_path / "summariser"
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(SKILL_MD)
    return tmp_path


def test_list_skills_closure_returns_json(tmp_path: Path) -> None:
    """Closure built from a real registry returns valid JSON skill list."""
    from backend.skills.skills import build_skill_registry, list_skills

    registry = build_skill_registry(tmp_path)  # empty root — returns []

    def list_skills_tool() -> str:
        return list_skills({}, registry)

    result = list_skills_tool()
    assert json.loads(result) == []


def test_list_skills_closure_finds_skill(skills_root: Path) -> None:
    """Closure built from a populated registry lists the available skill."""
    from backend.skills.skills import build_skill_registry, list_skills

    registry = build_skill_registry(skills_root)

    def list_skills_tool() -> str:
        return list_skills({}, registry)

    skills = json.loads(list_skills_tool())
    assert any(s["name"] == "summariser" for s in skills)
    assert all("description" in s for s in skills)


def test_read_skill_closure_returns_content_and_errors(skills_root: Path) -> None:
    """Closure built from registry returns content for known, error for unknown."""
    from backend.skills.skills import build_skill_registry, read_skill

    registry = build_skill_registry(skills_root)

    def read_skill_tool(skill_name: str) -> str:
        return read_skill({"skill_name": skill_name}, registry)

    assert "Summariser Skill" in read_skill_tool("summariser")
    assert read_skill_tool("nonexistent").startswith("Error:")


def test_dspy_agent_has_skills_root_constant() -> None:
    """dspy_agent must expose a SKILLS_ROOT Path constant."""
    import backend.dspy_agent as dspy_agent
    assert hasattr(dspy_agent, "SKILLS_ROOT")
    from pathlib import Path
    assert isinstance(dspy_agent.SKILLS_ROOT, Path)


def test_dspy_knowledge_agent_accepts_extra_tools() -> None:
    """DSPyKnowledgeAgent must accept a tools list and pass them to ReAct."""
    from backend.dspy_agent import DSPyKnowledgeAgent
    import dspy

    def fake_list_skills() -> str:
        """List available skills."""
        return "[]"

    def fake_read_skill(skill_name: str) -> str:
        """Read a skill by name."""
        return "skill content"

    # Should not raise; tools kwarg must be forwarded to dspy.ReAct
    agent = DSPyKnowledgeAgent(
        max_iters=2,
        tools=[fake_list_skills, fake_read_skill],
    )
    # dspy.ReAct stores tools as a dict keyed by tool name
    tool_names = list(agent.react.tools.keys())
    assert "fake_list_skills" in tool_names
    assert "fake_read_skill" in tool_names


def test_make_skill_tools_list_emits_skill_list_event(skills_root: Path) -> None:
    """list_skills_tool fires {"kind": "skill_list"} before returning."""
    from backend.dspy_agent import _make_skill_tools
    from backend.skills.skills import build_skill_registry

    registry = build_skill_registry(skills_root)
    events: list[dict] = []
    list_skills_tool, _ = _make_skill_tools(registry, event_callback=events.append)
    list_skills_tool()
    assert events == [{"kind": "skill_list"}]


def test_make_skill_tools_read_emits_skill_read_event(skills_root: Path) -> None:
    """read_skill_tool fires {"kind": "skill_read", ...} before returning."""
    from backend.dspy_agent import _make_skill_tools
    from backend.skills.skills import build_skill_registry

    registry = build_skill_registry(skills_root)
    events: list[dict] = []
    _, read_skill_tool = _make_skill_tools(registry, event_callback=events.append)
    read_skill_tool("summariser")
    assert len(events) == 1
    assert events[0]["kind"] == "skill_read"
    assert events[0]["name"] == "summariser"
    assert events[0]["desc"] == "Summarise long texts into bullet points."


def test_make_skill_tools_no_callback_does_not_raise(skills_root: Path) -> None:
    """Factory works without a callback — no event_callback provided."""
    from backend.dspy_agent import _make_skill_tools
    from backend.skills.skills import build_skill_registry

    registry = build_skill_registry(skills_root)
    list_skills_tool, read_skill_tool = _make_skill_tools(registry)
    list_skills_tool()          # must not raise
    read_skill_tool("summariser")  # must not raise


def test_make_skill_tools_list_returns_json(skills_root: Path) -> None:
    """list_skills_tool still returns valid JSON skill list."""
    import json
    from backend.dspy_agent import _make_skill_tools
    from backend.skills.skills import build_skill_registry

    registry = build_skill_registry(skills_root)
    list_skills_tool, _ = _make_skill_tools(registry)
    result = json.loads(list_skills_tool())
    assert any(s["name"] == "summariser" for s in result)


def test_search_knowledge_graph_tool_returns_empty_when_graph_unavailable() -> None:
    """search_knowledge_graph_tool returns '[]' when graph is not populated."""
    import json
    from unittest.mock import patch, MagicMock
    from backend.dspy_agent import search_knowledge_graph_tool
    from backend.knowledge.knowledge_graph import KnowledgeGraph

    mock_kg = MagicMock(spec=KnowledgeGraph)
    mock_kg.available = False

    with patch("backend.dspy_agent._get_knowledge_graph", return_value=mock_kg):
        result = search_knowledge_graph_tool("home insurance")
    assert json.loads(result) == []


def test_search_knowledge_graph_tool_calls_kg_search() -> None:
    """search_knowledge_graph_tool delegates to KnowledgeGraph.search()."""
    import json
    from unittest.mock import patch, MagicMock
    from backend.dspy_agent import search_knowledge_graph_tool
    from backend.knowledge.knowledge_graph import KnowledgeGraph

    mock_kg = MagicMock(spec=KnowledgeGraph)
    mock_kg.available = True
    mock_kg.search.return_value = [
        {"path": "insurance/home/index.md", "title": "Home Insurance", "summary": "Covers your home."}
    ]

    with patch("backend.dspy_agent._get_knowledge_graph", return_value=mock_kg):
        result = search_knowledge_graph_tool("home insurance", section="insurance")

    mock_kg.search.assert_called_once_with("home insurance", section="insurance")
    data = json.loads(result)
    assert data[0]["path"] == "insurance/home/index.md"


def test_search_knowledge_graph_tool_passes_none_for_empty_section() -> None:
    """Empty section string is converted to None before calling kg.search()."""
    import json
    from unittest.mock import patch, MagicMock
    from backend.dspy_agent import search_knowledge_graph_tool
    from backend.knowledge.knowledge_graph import KnowledgeGraph

    mock_kg = MagicMock(spec=KnowledgeGraph)
    mock_kg.available = True
    mock_kg.search.return_value = []

    with patch("backend.dspy_agent._get_knowledge_graph", return_value=mock_kg):
        search_knowledge_graph_tool("pension plans", section="")

    mock_kg.search.assert_called_once_with("pension plans", section=None)
