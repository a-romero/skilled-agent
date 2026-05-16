# DSPy Skills Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `list_skills` and `read_skill` tool integration to `dspy_agent.py`, mirroring the pattern already established in `agent.py`.

**Architecture:** Extract the shared skill-registry utilities (`build_skill_registry`, `list_skills`, `read_skill`) from `agent.py` into a new `skills.py` module. Both `agent.py` and `dspy_agent.py` import from it. In `dspy_agent.py`, two DSPy-compatible closure-based tool wrappers are constructed inside `run_agent()` capturing the registry, then passed into the `DSPyKnowledgeAgent` tool list alongside the existing `read_knowledge_tool`.

**Tech Stack:** Python 3.12, DSPy (`dspy.ReAct`), pytest with `tmp_path` fixtures.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `skills.py` | Shared skill-registry utilities used by both agents |
| Modify | `agent.py:40-97` | Replace local definitions with imports from `skills.py` |
| Modify | `dspy_agent.py` | Add skills tools + update signature docstring |
| Create | `tests/test_skills.py` | Unit tests for `skills.py` |
| Create | `tests/test_dspy_agent_skills.py` | Tests for skills integration in `dspy_agent.py` without LLM |

---

## Task 1: Create `skills.py` with shared skill-registry utilities

**Files:**
- Create: `skills.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_skills.py
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


def test_description_fallback_for_skill_without_frontmatter(tmp_path: Path) -> None:
    skill_dir = tmp_path / "bare-skill"
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text("# Bare Skill\n\nSome instructions.\n")
    registry = build_skill_registry(tmp_path)
    assert registry["bare-skill"]["description"] != ""
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/test_skills.py -v
```

Expected: `ModuleNotFoundError: No module named 'skills'`

- [ ] **Step 3: Create `skills.py`**

```python
"""Skill-registry utilities shared by agent.py and dspy_agent.py."""

import json
from pathlib import Path


def build_skill_registry(root: Path) -> dict[str, dict]:
    """Walk root and parse each SKILL.md for its frontmatter description.

    Returns {skill_name: {path, description}}.
    """
    registry: dict[str, dict] = {}
    if not root.exists():
        return registry
    for skill_md in root.rglob("SKILL.md"):
        skill_name = skill_md.parent.name
        registry[skill_name] = {
            "path": str(skill_md),
            "description": _extract_description(skill_md),
        }
    return registry


def _extract_description(path: Path) -> str:
    """Pull the `description` value out of YAML-ish frontmatter."""
    try:
        text = path.read_text(encoding="utf-8")
        if text.startswith("---"):
            end = text.index("---", 3)
            fm = text[3:end]
            for line in fm.splitlines():
                if line.strip().startswith("description:"):
                    val = line.split("description:", 1)[1].strip().strip('"').strip("'")
                    return val
        for line in text.splitlines():
            if line.strip() and not line.startswith("---") and not line.startswith("#"):
                return line.strip()[:200]
    except Exception:
        pass
    return "(no description)"


def list_skills(_input: dict, registry: dict) -> str:
    """Return a JSON list of available skills and their one-line descriptions."""
    skills = [
        {"name": name, "description": meta["description"]}
        for name, meta in registry.items()
    ]
    return json.dumps(skills, indent=2)


def read_skill(input_: dict, registry: dict) -> str:
    """Read and return the full contents of a SKILL.md file."""
    name = input_.get("skill_name", "").strip()
    if name not in registry:
        available = ", ".join(registry.keys())
        return f"Error: skill '{name}' not found. Available: {available}"
    path = Path(registry[name]["path"])
    return path.read_text(encoding="utf-8")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
uv run pytest tests/test_skills.py -v
```

Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add skills.py tests/test_skills.py
git commit -m "feat: add shared skills.py with skill-registry utilities"
```

---

## Task 2: Update `agent.py` to import from `skills.py`

**Files:**
- Modify: `agent.py:40-97`

- [ ] **Step 1: Run existing tests to establish baseline**

```bash
uv run pytest tests/ -v
```

Expected: all existing tests PASS

- [ ] **Step 2: Replace local definitions with imports in `agent.py`**

Remove the functions `build_skill_registry`, `_extract_description`, `list_skills`, `read_skill` from `agent.py` (lines 40–97) and replace the block with a single import line.

Replace this block in `agent.py`:

```python
# ---------------------------------------------------------------------------
# Skill registry — built once at startup by scanning SKILLS_ROOT
# ---------------------------------------------------------------------------

def build_skill_registry(root: Path) -> dict[str, dict]:
    """
    Walk SKILLS_ROOT and parse each SKILL.md for its frontmatter description.
    Returns a dict: { skill_name -> { path, description } }
    """
    registry = {}
    for skill_md in root.rglob("SKILL.md"):
        skill_name = skill_md.parent.name
        description = _extract_description(skill_md)
        registry[skill_name] = {
            "path": str(skill_md),
            "description": description,
        }
    return registry


def _extract_description(path: Path) -> str:
    """Pull the `description` value out of YAML-ish frontmatter."""
    try:
        text = path.read_text(encoding="utf-8")
        if text.startswith("---"):
            end = text.index("---", 3)
            fm = text[3:end]
            for line in fm.splitlines():
                if line.strip().startswith("description:"):
                    # strip the key and any surrounding quotes
                    val = line.split("description:", 1)[1].strip().strip('"').strip("'")
                    return val
        # fallback: first non-empty line after the frontmatter
        for line in text.splitlines():
            if line.strip() and not line.startswith("---") and not line.startswith("#"):
                return line.strip()[:200]
    except Exception:
        pass
    return "(no description)"


# ---------------------------------------------------------------------------
# Built-in tools (always available to the agent)
# ---------------------------------------------------------------------------

def list_skills(_input: dict, registry: dict) -> str:
    """Return a JSON list of available skills and their one-line descriptions."""
    skills = [
        {"name": name, "description": meta["description"]}
        for name, meta in registry.items()
    ]
    return json.dumps(skills, indent=2)


def read_skill(input_: dict, registry: dict) -> str:
    """Read and return the full contents of a SKILL.md file."""
    name = input_.get("skill_name", "").strip()
    if name not in registry:
        available = ", ".join(registry.keys())
        return f"Error: skill '{name}' not found. Available: {available}"
    path = Path(registry[name]["path"])
    return path.read_text(encoding="utf-8")
```

With:

```python
from skills import build_skill_registry, list_skills, read_skill
```

- [ ] **Step 3: Run all tests to verify nothing broke**

```bash
uv run pytest tests/ -v
```

Expected: all tests PASS (same count as baseline)

- [ ] **Step 4: Commit**

```bash
git add agent.py
git commit -m "refactor: import skill-registry utilities from skills.py"
```

---

## Task 3: Add skills tools to `dspy_agent.py`

**Files:**
- Modify: `dspy_agent.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_dspy_agent_skills.py
import textwrap
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock


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
    """list_skills_tool should list skills from the skills root."""
    import dspy_agent

    with patch.object(dspy_agent, "SKILLS_ROOT", skills_root):
        from skills import build_skill_registry, list_skills
        registry = build_skill_registry(skills_root)
        result = list_skills({}, registry)

    import json
    skills = json.loads(result)
    names = [s["name"] for s in skills]
    assert "summariser" in names


def test_read_skill_tool_returns_content(skills_root: Path) -> None:
    """read_skill_tool should return SKILL.md content for a known skill."""
    from skills import build_skill_registry, read_skill
    registry = build_skill_registry(skills_root)
    result = read_skill({"skill_name": "summariser"}, registry)
    assert "Summariser Skill" in result


def test_read_skill_tool_error_for_unknown(skills_root: Path) -> None:
    """read_skill_tool should return an error for an unknown skill name."""
    from skills import build_skill_registry, read_skill
    registry = build_skill_registry(skills_root)
    result = read_skill({"skill_name": "does-not-exist"}, registry)
    assert result.startswith("Error:")


def test_dspy_agent_tools_include_skills(tmp_path: Path) -> None:
    """DSPyKnowledgeAgent constructed with skills tools exposes them by name."""
    import dspy
    from dspy_agent import DSPyKnowledgeAgent

    def fake_list_skills() -> str:  # type: ignore[return]
        """List available skills."""
        return "[]"

    def fake_read_skill(skill_name: str) -> str:  # type: ignore[return]
        """Read a skill by name."""
        return "skill content"

    agent = DSPyKnowledgeAgent(
        max_iters=5,
        tools=[fake_list_skills, fake_read_skill],
    )
    tool_names = [t.__name__ for t in agent.react.tools]
    assert "fake_list_skills" in tool_names
    assert "fake_read_skill" in tool_names
```

- [ ] **Step 2: Run test to verify it fails**

```bash
uv run pytest tests/test_dspy_agent_skills.py -v
```

Expected: `test_dspy_agent_tools_include_skills` FAIL because `DSPyKnowledgeAgent` doesn't expose `react.tools` in the expected way, or PASS for the skills-utility tests that don't require dspy_agent changes yet. Confirm which tests fail.

- [ ] **Step 3: Add imports and `SKILLS_ROOT` constant to `dspy_agent.py`**

Add after the existing imports at the top of `dspy_agent.py`:

```python
from skills import build_skill_registry, list_skills, read_skill

SKILLS_ROOT = Path("./skills")
```

- [ ] **Step 4: Update `KnowledgeAgentSignature` docstring to mention skills**

Replace the current class docstring:

```python
class KnowledgeAgentSignature(dspy.Signature):
    """Answer customer queries about Aviva's products and services.

    Use the read_knowledge tool to navigate the knowledge base:
    1. Start with SUMMARY.MD files to explore sections.
    2. Read specific index.md pages for full content.
    3. Always cite sources (title and URL) at the end of your answer.

    Format your sources section as:
    ## Sources
    - [Page Title](https://url)
    """
```

With:

```python
class KnowledgeAgentSignature(dspy.Signature):
    """Answer customer queries about Aviva's products and services.

    You have access to a skill library and a knowledge base.

    Skills:
    1. Call list_skills to discover available skills and their descriptions.
    2. Call read_skill with a skill name to load its full instructions.
    3. Only read a skill if it is relevant to the task.

    Knowledge base:
    4. Use read_knowledge to navigate: start with SUMMARY.MD files, then read
       specific index.md pages for full content.
    5. Always cite sources (title and URL) at the end of your answer.

    Format your sources section as:
    ## Sources
    - [Page Title](https://url)
    """
```

- [ ] **Step 5: Add skills closure tools and pass them into the agent in `run_agent()`**

In `run_agent()`, add skill registry setup after `_configure_dspy()` and before tracing setup:

```python
    skill_registry = build_skill_registry(SKILLS_ROOT)

    def list_skills_tool() -> str:
        """List all available skills with their one-line descriptions.
        Call this first to discover what capabilities are available before
        deciding which skill to load."""
        return list_skills({}, skill_registry)

    def read_skill_tool(skill_name: str) -> str:
        """Read the full SKILL.md for a named skill. Only call when you have
        determined the skill is relevant. The file contains instructions and
        examples.

        Args:
            skill_name: Exact skill name as returned by list_skills_tool.
        """
        return read_skill({"skill_name": skill_name}, skill_registry)
```

Then update the `_instrumented_read` block and agent construction to also pass the skills tools:

```python
    agent = DSPyKnowledgeAgent(
        max_iters=10,
        tools=[list_skills_tool, read_skill_tool, _instrumented_read],
    )
```

- [ ] **Step 6: Run all tests**

```bash
uv run pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add dspy_agent.py tests/test_dspy_agent_skills.py
git commit -m "feat: add list_skills and read_skill tools to DSPy agent"
```

---

## Self-Review

### Spec coverage

| Requirement | Covered by |
|-------------|------------|
| `list_skills` tool in DSPy agent | Task 3, step 5 |
| `read_skill` tool in DSPy agent | Task 3, step 5 |
| Mirrors `agent.py` pattern | Both use `skills.py` functions; closure approach mirrors handler routing |
| Shared utilities extracted | Task 1 (`skills.py`) + Task 2 (`agent.py` refactor) |
| Tests for skill utilities | Task 1 |
| Tests for DSPy integration | Task 3 |

### Placeholder scan

None — all code blocks are complete and runnable.

### Type consistency

- `build_skill_registry(root: Path) -> dict[str, dict]` — used the same in `agent.py` and `dspy_agent.py`
- `list_skills({}, registry)` and `read_skill({"skill_name": ...}, registry)` — match `skills.py` signatures exactly
- `DSPyKnowledgeAgent(tools=[...])` — list of callables, matching existing constructor signature
