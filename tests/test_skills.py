import json
import textwrap
import pytest
from pathlib import Path
from skills import build_skill_registry, list_skills, read_skill


SKILL_MD = textwrap.dedent("""\
    ---
    name: python-coder
    description: "Write and run Python scripts."
    ---

    # Python Coder Skill

    Instructions go here.
""")


@pytest.fixture
def skills_root(tmp_path: Path) -> Path:
    skill_dir = tmp_path / "python-coder"
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(SKILL_MD)
    return tmp_path


def test_build_skill_registry_finds_skill(skills_root: Path) -> None:
    registry = build_skill_registry(skills_root)
    assert "python-coder" in registry


def test_build_skill_registry_extracts_description(skills_root: Path) -> None:
    registry = build_skill_registry(skills_root)
    assert registry["python-coder"]["description"] == "Write and run Python scripts."


def test_build_skill_registry_stores_path(skills_root: Path) -> None:
    registry = build_skill_registry(skills_root)
    assert registry["python-coder"]["path"].endswith("SKILL.md")


def test_build_skill_registry_empty_for_missing_root(tmp_path: Path) -> None:
    registry = build_skill_registry(tmp_path / "nonexistent")
    assert registry == {}


def test_list_skills_returns_json_array(skills_root: Path) -> None:
    registry = build_skill_registry(skills_root)
    result = list_skills({}, registry)
    skills = json.loads(result)
    assert isinstance(skills, list)
    assert skills[0]["name"] == "python-coder"
    assert "description" in skills[0]


def test_read_skill_returns_content(skills_root: Path) -> None:
    registry = build_skill_registry(skills_root)
    result = read_skill({"skill_name": "python-coder"}, registry)
    assert "Python Coder Skill" in result


def test_read_skill_unknown_returns_error(skills_root: Path) -> None:
    registry = build_skill_registry(skills_root)
    result = read_skill({"skill_name": "nonexistent"}, registry)
    assert result.startswith("Error:")


def test_read_skill_error_when_file_deleted(skills_root: Path) -> None:
    registry = build_skill_registry(skills_root)
    (skills_root / "python-coder" / "SKILL.md").unlink()
    result = read_skill({"skill_name": "python-coder"}, registry)
    assert result.startswith("Error:")


def test_description_fallback_for_skill_without_frontmatter(tmp_path: Path) -> None:
    skill_dir = tmp_path / "bare-skill"
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text("# Bare Skill\n\nSome instructions.\n")
    registry = build_skill_registry(tmp_path)
    assert registry["bare-skill"]["description"] == "Some instructions."
