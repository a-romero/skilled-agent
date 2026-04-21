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


def test_list_skills_tool_returns_available_skills(skills_root: Path) -> None:
    """list_skills tool should return JSON listing skills from the registry."""
    from skills import build_skill_registry, list_skills
    registry = build_skill_registry(skills_root)
    result = list_skills({}, registry)
    skills = json.loads(result)
    names = [s["name"] for s in skills]
    assert "summariser" in names


def test_read_skill_tool_returns_content(skills_root: Path) -> None:
    """read_skill tool should return SKILL.md content for a known skill."""
    from skills import build_skill_registry, read_skill
    registry = build_skill_registry(skills_root)
    result = read_skill({"skill_name": "summariser"}, registry)
    assert "Summariser Skill" in result


def test_read_skill_tool_error_for_unknown(skills_root: Path) -> None:
    """read_skill tool should return an error for an unknown skill name."""
    from skills import build_skill_registry, read_skill
    registry = build_skill_registry(skills_root)
    result = read_skill({"skill_name": "does-not-exist"}, registry)
    assert result.startswith("Error:")


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
