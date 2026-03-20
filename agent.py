"""
Skill-Aware Agent Loop
======================
An Anthropic SDK-based agent that lazily loads skill markdown files from a
filesystem — only reading them when the task at hand requires it, mirroring
the Claude Code pattern.

Flow:
  1. Agent receives a task
  2. Tool call: list_skills  → shows available skills + descriptions
  3. Tool call: read_skill   → reads the full SKILL.md only when needed
  4. Tool call: <any skill-defined tool>  → actual work
  5. Loop until the agent returns a final text answer (no tool calls)
"""

import os
import json
import anthropic
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MODEL = "claude-opus-4-5"          # use the latest Opus; swap to sonnet for speed
SKILLS_ROOT = Path("./skills")     # root of the skills filesystem
MAX_ITERATIONS = 20                # guard against infinite loops

client = anthropic.Anthropic()     # reads ANTHROPIC_API_KEY from env


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
        text = path.read_text()
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
    return path.read_text()


# ---------------------------------------------------------------------------
# Skill-defined tools — loaded lazily when read_skill is called
# ---------------------------------------------------------------------------
# Skills can define tools in their SKILL.md under a ```tools_json fence.
# Format:
#   ```tools_json
#   [ { "name": "...", "description": "...", "input_schema": { ... } } ]
#   ```
# Handlers for those tools must be registered in SKILL_TOOL_HANDLERS below.

def _parse_skill_tools(skill_content: str) -> list[dict]:
    """Extract tool definitions from a skill's markdown."""
    import re
    pattern = r"```tools_json\s*([\s\S]*?)```"
    match = re.search(pattern, skill_content)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    return []


# Register handlers for every tool that skills can expose.
# Keys must match the tool `name` in the skill's tools_json block.
SKILL_TOOL_HANDLERS: dict[str, Any] = {
    # Example: a "write_file" tool defined in the file-writer skill
    "write_file": lambda inp: _handle_write_file(inp),
    "read_file":  lambda inp: _handle_read_file(inp),
    "run_python": lambda inp: _handle_run_python(inp),
}


def _handle_write_file(inp: dict) -> str:
    path = Path(inp["path"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(inp["content"])
    return f"Written {len(inp['content'])} chars to {path}"


def _handle_read_file(inp: dict) -> str:
    path = Path(inp["path"])
    if not path.exists():
        return f"Error: {path} does not exist"
    return path.read_text()


def _handle_run_python(inp: dict) -> str:
    import subprocess, sys, tempfile
    code = inp.get("code", "")
    with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
        f.write(code)
        tmp = f.name
    result = subprocess.run(
        [sys.executable, tmp], capture_output=True, text=True, timeout=30
    )
    out = result.stdout + result.stderr
    return out.strip() or "(no output)"


# ---------------------------------------------------------------------------
# Core tool definitions sent to the API (always-available tools)
# ---------------------------------------------------------------------------

CORE_TOOLS = [
    {
        "name": "list_skills",
        "description": (
            "List all available skills with their one-line descriptions. "
            "Call this first to discover what capabilities are available before "
            "deciding which skill(s) to load."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "read_skill",
        "description": (
            "Read the full SKILL.md for a named skill. Only read a skill when "
            "you have determined it is relevant to the current task. The skill "
            "file will contain instructions, examples, and possibly tool "
            "definitions you can then use."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "skill_name": {
                    "type": "string",
                    "description": "Exact skill name as returned by list_skills",
                }
            },
            "required": ["skill_name"],
        },
    },
]


# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------

def run_agent(task: str, verbose: bool = True) -> str:
    """
    Run the skill-aware agent loop for a given task.
    Returns the agent's final text response.
    """
    registry = build_skill_registry(SKILLS_ROOT)
    active_skill_tools: list[dict] = []   # tools unlocked after read_skill calls
    loaded_skills: set[str] = set()

    messages: list[dict] = [{"role": "user", "content": task}]

    system_prompt = f"""You are a capable AI agent with access to a skill library.

Skills are organised as markdown files in a filesystem. You must:
1. Call `list_skills` to discover available skills.
2. Call `read_skill` for any skill that looks relevant — read it fully before using it.
3. Follow the instructions in the skill file precisely.
4. Only read a skill if it's actually needed for the task.

Current working directory: {Path.cwd()}
Available skills root: {SKILLS_ROOT.resolve()}
"""

    for iteration in range(MAX_ITERATIONS):
        all_tools = CORE_TOOLS + active_skill_tools

        if verbose:
            print(f"\n{'='*60}")
            print(f"Iteration {iteration + 1}")
            print(f"Active skill tools: {[t['name'] for t in active_skill_tools]}")

        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=system_prompt,
            tools=all_tools,
            messages=messages,
        )

        if verbose:
            print(f"Stop reason: {response.stop_reason}")

        # Append assistant turn
        messages.append({"role": "assistant", "content": response.content})

        # If no tool calls → done
        if response.stop_reason == "end_turn":
            final = " ".join(
                block.text for block in response.content
                if hasattr(block, "text")
            )
            if verbose:
                print(f"\nFinal answer:\n{final}")
            return final

        # Process tool calls
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue

            tool_name = block.name
            tool_input = block.input
            tool_use_id = block.id

            if verbose:
                print(f"\nTool call: {tool_name}")
                print(f"Input: {json.dumps(tool_input, indent=2)}")

            # Route to the appropriate handler
            if tool_name == "list_skills":
                result = list_skills(tool_input, registry)

            elif tool_name == "read_skill":
                result = read_skill(tool_input, registry)
                skill_name = tool_input.get("skill_name", "")
                # Unlock any tools defined in this skill
                if skill_name not in loaded_skills and skill_name in registry:
                    new_tools = _parse_skill_tools(result)
                    if new_tools:
                        active_skill_tools.extend(new_tools)
                        loaded_skills.add(skill_name)
                        if verbose:
                            print(f"Unlocked tools from '{skill_name}': "
                                  f"{[t['name'] for t in new_tools]}")

            elif tool_name in SKILL_TOOL_HANDLERS:
                try:
                    result = SKILL_TOOL_HANDLERS[tool_name](tool_input)
                except Exception as e:
                    result = f"Error executing {tool_name}: {e}"

            else:
                result = f"Error: unknown tool '{tool_name}'"

            if verbose:
                preview = str(result)[:300]
                print(f"Result preview: {preview}{'...' if len(str(result)) > 300 else ''}")

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "content": str(result),
            })

        # Append user turn with all tool results
        messages.append({"role": "user", "content": tool_results})

    return "Error: maximum iterations reached without a final answer."


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    task = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else (
        "Write a Python script that prints the first 10 Fibonacci numbers "
        "and save it to ./output/fibonacci.py, then run it."
    )

    print(f"Task: {task}\n")
    answer = run_agent(task)
    print(f"\n{'='*60}\nDone.\n{answer}")
