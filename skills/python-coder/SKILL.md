---
name: python-coder
description: "Write, save, and execute Python scripts. Use when asked to create scripts, run code, or produce file-based Python output."
---

# Python Coder Skill

Use this skill whenever you need to write Python code to a file and optionally run it.

## When to use

- User asks you to write a Python script
- User asks you to run Python code and show the output
- User wants code saved to disk

## Instructions

1. Write the complete, working Python code first — no placeholders.
2. Use `write_file` to save the script to the requested path (default: `./output/<name>.py`).
3. Optionally use `run_python` to execute it and capture output.
4. Report the output to the user.

## Examples

### Writing and running a script

```python
# Always write clean, runnable code with a main guard
def main():
    for i in range(10):
        print(i)

if __name__ == "__main__":
    main()
```

Save with `write_file`, then run with `run_python` passing the same code.

## Tools

The following tools are available once you load this skill:

```tools_json
[
  {
    "name": "write_file",
    "description": "Write content to a file on disk, creating directories as needed.",
    "input_schema": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Relative or absolute file path to write to"
        },
        "content": {
          "type": "string",
          "description": "Full text content to write"
        }
      },
      "required": ["path", "content"]
    }
  },
  {
    "name": "read_file",
    "description": "Read the contents of a file from disk.",
    "input_schema": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "File path to read"
        }
      },
      "required": ["path"]
    }
  },
  {
    "name": "run_python",
    "description": "Execute a Python code snippet in a subprocess and return stdout + stderr.",
    "input_schema": {
      "type": "object",
      "properties": {
        "code": {
          "type": "string",
          "description": "Valid Python code to execute"
        }
      },
      "required": ["code"]
    }
  }
]
```
