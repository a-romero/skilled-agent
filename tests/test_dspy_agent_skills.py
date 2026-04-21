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
    from skills import build_skill_registry, list_skills

    registry = build_skill_registry(tmp_path)  # empty root — returns []

    def list_skills_tool() -> str:
        return list_skills({}, registry)

    result = list_skills_tool()
    assert json.loads(result) == []


def test_list_skills_closure_finds_skill(skills_root: Path) -> None:
    """Closure built from a populated registry lists the available skill."""
    from skills import build_skill_registry, list_skills

    registry = build_skill_registry(skills_root)

    def list_skills_tool() -> str:
        return list_skills({}, registry)

    skills = json.loads(list_skills_tool())
    assert any(s["name"] == "summariser" for s in skills)
    assert all("description" in s for s in skills)


def test_read_skill_closure_returns_content_and_errors(skills_root: Path) -> None:
    """Closure built from registry returns content for known, error for unknown."""
    from skills import build_skill_registry, read_skill

    registry = build_skill_registry(skills_root)

    def read_skill_tool(skill_name: str) -> str:
        return read_skill({"skill_name": skill_name}, registry)

    assert "Summariser Skill" in read_skill_tool("summariser")
    assert read_skill_tool("nonexistent").startswith("Error:")


def test_dspy_agent_has_skills_root_constant() -> None:
    """dspy_agent must expose a SKILLS_ROOT Path constant."""
    import dspy_agent
    assert hasattr(dspy_agent, "SKILLS_ROOT")
    from pathlib import Path
    assert isinstance(dspy_agent.SKILLS_ROOT, Path)


def test_dspy_knowledge_agent_accepts_extra_tools() -> None:
    """DSPyKnowledgeAgent must accept a tools list and pass them to ReAct."""
    from dspy_agent import DSPyKnowledgeAgent
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
