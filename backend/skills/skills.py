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
    except OSError:
        return "(no description)"
    if text.startswith("---"):
        try:
            end = text.index("---", 3)
        except ValueError:
            pass
        else:
            fm = text[3:end]
            for line in fm.splitlines():
                if line.strip().startswith("description:"):
                    val = line.split("description:", 1)[1].strip().strip('"').strip("'")
                    return val
    for line in text.splitlines():
        if line.strip() and not line.startswith("---") and not line.startswith("#"):
            return line.strip()[:200]
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
    if not path.exists():
        return f"Error: skill '{name}' file not found"
    return path.read_text(encoding="utf-8")
