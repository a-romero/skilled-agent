# Code Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate code duplication and improve consistency by creating shared utility modules across backend (Python) and frontend (TypeScript)

**Architecture:** Create 8 new utility modules (4 backend, 4 frontend) to consolidate duplicate code patterns, then refactor existing files to use these utilities. Backend gets centralized YAML parsing, config validation, path security, file I/O, and logging. Frontend gets centralized API config, state management, fetch helpers, and logging.

**Tech Stack:** Python 3.10+, TypeScript, FastAPI, React 19, pytest, vitest

---

## File Structure

**New Backend Files:**
- `backend/utils/file_io.py` - Safe file reading with error handling
- `backend/utils/yaml_parser.py` - YAML frontmatter parsing
- `backend/utils/config.py` - Environment variable validation
- `backend/utils/path_security.py` - Path traversal protection

**New Frontend Files:**
- `frontend/src/config/api.ts` - API base URL constant
- `frontend/src/utils/logger.ts` - Structured logging service
- `frontend/src/utils/api.ts` - Fetch helper utilities
- `frontend/src/hooks/useApiState.ts` - Loading/error state hook

**Modified Backend Files:**
- `backend/server.py` - Use new utilities, add logging
- `backend/utils/llm.py` - Use config validation utility
- `backend/dspy_agent.py` - Use config validation utility
- `backend/knowledge/knowledge.py` - Use new utilities
- `backend/knowledge/enrich_knowledge.py` - Use new utilities
- `backend/skills/skills.py` - Add logging for exceptions

**Modified Frontend Files:**
- `frontend/src/hooks/useChat.ts` - Use new utilities
- `frontend/src/hooks/useKnowledge.ts` - Use new utilities
- `frontend/src/hooks/useSkills.ts` - Use new utilities
- `frontend/src/hooks/useConfig.ts` - Use new utilities
- `frontend/src/hooks/useConversations.ts` - Use new utilities
- `frontend/src/components/knowledge/FilePreview.tsx` - Use new utilities

---

## Task 1: Backend File I/O Utility

**Files:**
- Create: `backend/utils/file_io.py`

- [ ] **Step 1: Create file I/O utility with safe file reading**

```python
"""Safe file I/O utilities with consistent error handling."""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def safe_read_text(path: Path, encoding: str = "utf-8") -> str:
    """Read file with consistent error handling and logging.
    
    Args:
        path: Path to file to read
        encoding: Text encoding (default: utf-8)
    
    Returns:
        File contents as string
    
    Raises:
        FileNotFoundError: If file doesn't exist
        IOError: If file cannot be read
    """
    try:
        return path.read_text(encoding=encoding)
    except FileNotFoundError:
        logger.error(f"File not found: {path}")
        raise
    except Exception as e:
        logger.error(f"Failed to read file {path}: {e}", exc_info=True)
        raise IOError(f"Failed to read file {path}: {e}") from e
```

- [ ] **Step 2: Commit**

```bash
git add backend/utils/file_io.py
git commit -m "feat: add safe file reading utility"
```

---

## Task 2: Backend YAML Parser Utility

**Files:**
- Create: `backend/utils/yaml_parser.py`

- [ ] **Step 1: Create YAML parser utility**

```python
"""YAML frontmatter parsing utilities."""
import logging
from pathlib import Path
from typing import Any

import yaml

from backend.utils.file_io import safe_read_text

logger = logging.getLogger(__name__)


def parse_index_md(path: Path) -> dict[str, Any]:
    """Parse YAML frontmatter from markdown file.
    
    Args:
        path: Path to markdown file with optional YAML frontmatter
    
    Returns:
        Dict with 'frontmatter' (dict) and 'body' (str) keys
    """
    try:
        text = safe_read_text(path)
    except Exception as e:
        logger.warning(f"Failed to read {path}: {e}")
        return {"frontmatter": {}, "body": ""}

    # Check for YAML frontmatter (--- at start)
    if not text.startswith("---"):
        return {"frontmatter": {}, "body": text}

    # Find closing ---
    end = text.find("---", 3)
    if end == -1:
        return {"frontmatter": {}, "body": text}

    # Extract and parse frontmatter
    fm_raw = text[3:end]
    body = text[end + 3:].strip()
    
    try:
        fm = yaml.safe_load(fm_raw) or {}
    except Exception as e:
        logger.warning(f"Failed to parse YAML frontmatter in {path}: {e}")
        fm = {}
    
    return {"frontmatter": fm, "body": body}
```

- [ ] **Step 2: Commit**

```bash
git add backend/utils/yaml_parser.py
git commit -m "feat: add YAML frontmatter parser utility"
```

---

## Task 3: Backend Config Validation Utility

**Files:**
- Create: `backend/utils/config.py`

- [ ] **Step 1: Create config validation utility**

```python
"""Environment variable validation utilities."""
import logging
import os

logger = logging.getLogger(__name__)


def validate_llm_config(
    provider: str | None = None,
    model: str | None = None,
    api_key: str | None = None,
) -> tuple[str, str, str]:
    """Validate LLM configuration from environment or parameters.
    
    Args:
        provider: LLM provider ('anthropic' or 'litellm'), or None to read from env
        model: Model name, or None to read from env
        api_key: API key, or None to read from env
    
    Returns:
        Tuple of (provider, model, api_key)
    
    Raises:
        ValueError: If required configuration is missing or invalid
    """
    # Validate provider
    provider = provider or os.environ.get("LLM_PROVIDER")
    if not provider:
        raise ValueError(
            "LLM_PROVIDER environment variable not set and no explicit provider passed"
        )
    if provider not in ("anthropic", "litellm"):
        raise ValueError(
            f"Invalid LLM_PROVIDER: {provider!r}. Must be 'anthropic' or 'litellm'"
        )
    
    # Validate model
    model = model or os.environ.get("LLM_MODEL")
    if not model:
        raise ValueError(
            "LLM_MODEL environment variable not set and no explicit model passed"
        )
    
    # Validate API key based on provider
    if provider == "anthropic":
        api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY environment variable not set and no explicit api_key passed"
            )
    elif provider == "litellm":
        api_key = api_key or os.environ.get("LITELLM_API_KEY")
        # LiteLLM API key is optional for some providers
    
    logger.debug(f"LLM config validated: provider={provider}, model={model}")
    return (provider, model, api_key or "")
```

- [ ] **Step 2: Commit**

```bash
git add backend/utils/config.py
git commit -m "feat: add LLM config validation utility"
```

---

## Task 4: Backend Path Security Utility

**Files:**
- Create: `backend/utils/path_security.py`

- [ ] **Step 1: Create path security utility**

```python
"""Path traversal protection utilities."""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def validate_safe_path(path: Path, root: Path) -> None:
    """Validate that path is within root directory (prevent path traversal).
    
    Args:
        path: Path to validate
        root: Root directory that path must be within
    
    Raises:
        ValueError: If path is outside root directory
    """
    resolved_path = path.resolve()
    resolved_root = root.resolve()
    
    # Check if path is within root (either is root or has root as parent)
    if resolved_root not in resolved_path.parents and resolved_path != resolved_root:
        logger.warning(f"Path traversal attempt detected: {path} outside {root}")
        raise ValueError(f"Path is outside the allowed root directory")
```

- [ ] **Step 2: Commit**

```bash
git add backend/utils/path_security.py
git commit -m "feat: add path traversal protection utility"
```

---

## Task 5: Configure Backend Logging

**Files:**
- Modify: `backend/server.py` (add at top after imports)

- [ ] **Step 1: Configure logging at application startup**

Add after the `load_dotenv()` call:

```python
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
```

- [ ] **Step 2: Commit**

```bash
git add backend/server.py
git commit -m "feat: configure structured logging for backend"
```

---

## Task 6: Refactor backend/server.py - YAML Parsing

**Files:**
- Modify: `backend/server.py`

- [ ] **Step 1: Update imports to use new utilities**

Replace the yaml import section with:

```python
from backend.utils.yaml_parser import parse_index_md
```

Remove standalone `import yaml` if not used elsewhere.

- [ ] **Step 2: Remove duplicate _parse_index_md function**

Delete the `_parse_index_md` function (lines ~80-95) entirely since we now import it.

- [ ] **Step 3: Update _build_tree to use imported parser**

In the `_build_tree` function, the call to `_parse_index_md(index_path)` should now use the imported function (no changes needed to the call itself).

- [ ] **Step 4: Update _parse_summary_md to use safe_read_text and add logging**

Replace the function:

```python
from backend.utils.file_io import safe_read_text

def _parse_summary_md(path: Path) -> str:
    """Return the one-paragraph description from a SUMMARY.MD file."""
    try:
        text = safe_read_text(path)
        # First non-heading, non-empty paragraph after the title
        lines = text.splitlines()
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                return stripped
    except Exception as e:
        logger.warning(f"Failed to parse SUMMARY.MD at {path}: {e}")
    return ""
```

- [ ] **Step 5: Commit**

```bash
git add backend/server.py
git commit -m "refactor: use YAML parser utility in server"
```

---

## Task 7: Refactor backend/knowledge/knowledge.py

**Files:**
- Modify: `backend/knowledge/knowledge.py`

- [ ] **Step 1: Update imports**

Add at top with other imports:

```python
import logging

from backend.utils.yaml_parser import parse_index_md
from backend.utils.path_security import validate_safe_path

logger = logging.getLogger(__name__)
```

Remove standalone `import yaml` if present.

- [ ] **Step 2: Remove duplicate _parse_index_md function**

Delete the `_parse_index_md` function (lines ~14-29).

- [ ] **Step 3: Update read_knowledge_file to use new utilities**

Replace the function:

```python
def read_knowledge_file(rel_path: str, knowledge_root: Path | None = None) -> dict[str, Any]:
    """Read a knowledge file and return structured data with path, frontmatter, and body.
    
    Args:
        rel_path: Knowledge-relative path, e.g. 'business/group-life/index.md'
        knowledge_root: Optional override for knowledge root path
    
    Returns:
        Dict with 'path', 'frontmatter', and 'body' keys
    
    Raises:
        FileNotFoundError: If the file doesn't exist or path is invalid
    """
    if knowledge_root is None:
        knowledge_root = KNOWLEDGE_ROOT
    
    resolved_root = knowledge_root.resolve()
    target = (knowledge_root / rel_path).resolve()
    
    # Security check using utility
    try:
        validate_safe_path(target, resolved_root)
    except ValueError:
        raise FileNotFoundError(f"Path '{rel_path}' is outside the knowledge root")
    
    if not target.exists():
        raise FileNotFoundError(f"File '{rel_path}' not found in knowledge base")
    
    if not target.is_file():
        raise FileNotFoundError(f"Path '{rel_path}' is not a file")
    
    parsed = parse_index_md(target)
    
    return {
        "path": rel_path,
        "frontmatter": parsed["frontmatter"],
        "body": parsed["body"],
    }
```

- [ ] **Step 4: Update build_source_registry to use safe_read_text**

Find the line with `readme.read_text(encoding="utf-8")` and add error handling:

```python
from backend.utils.file_io import safe_read_text

def build_source_registry(readme: Path) -> dict[str, dict]:
    """Parse knowledge/README.md table into {relative_path: {url, title}}."""
    registry: dict[str, dict] = {}
    try:
        content = safe_read_text(readme)
    except Exception as e:
        logger.error(f"Failed to read README.md: {e}")
        return registry
    
    for line in content.splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 3:
```

- [ ] **Step 5: Commit**

```bash
git add backend/knowledge/knowledge.py
git commit -m "refactor: use shared utilities in knowledge.py"
```

---

## Task 8: Refactor backend/utils/llm.py

**Files:**
- Modify: `backend/utils/llm.py`

- [ ] **Step 1: Update imports and add logging**

Add at top:

```python
import logging

from backend.utils.config import validate_llm_config

logger = logging.getLogger(__name__)
```

- [ ] **Step 2: Refactor create_client to use config validation**

Replace the validation section (lines ~61-81) with:

```python
def create_client(
    provider: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
    api_key: str | None = None,
) -> LLMClient:
    """Construct the appropriate SDK client and return an LLMClient."""
    provider, model, api_key = validate_llm_config(provider, model, api_key)

    if provider == "anthropic":
        raw: Any = anthropic.Anthropic(api_key=api_key)
    elif provider == "litellm":
        base_url = base_url or os.environ.get("LITELLM_BASE_URL")
        raw = {"api_base": base_url, "api_key": api_key}
    else:
        # This shouldn't happen since validate_llm_config checks provider
        raise ValueError(f"Unknown provider: {provider!r}")

    logger.info(f"Created LLM client: provider={provider}, model={model}")
    return LLMClient(provider=provider, model=model, _raw=raw)
```

- [ ] **Step 3: Commit**

```bash
git add backend/utils/llm.py
git commit -m "refactor: use config validation utility in llm.py"
```

---

## Task 9: Refactor backend/dspy_agent.py

**Files:**
- Modify: `backend/dspy_agent.py`

- [ ] **Step 1: Update imports**

Add at top with other imports:

```python
import logging

from backend.utils.config import validate_llm_config

logger = logging.getLogger(__name__)
```

- [ ] **Step 2: Refactor env validation in main section**

Find the section around lines 208-220 that validates env vars and replace with:

```python
    # Get configuration
    try:
        provider, model, _ = validate_llm_config()
    except ValueError as e:
        if verbose:
            logger.error(f"Configuration error: {e}")
        else:
            print(f"Configuration error: {e}")
        return
```

- [ ] **Step 3: Replace print() with logger calls**

Find all `print()` calls and replace with appropriate logger calls:

```python
# Replace:
if verbose:
    print(f"...message...")

# With:
if verbose:
    logger.info("...message...")
```

Keep the CLI argument parsing `print()` calls as-is since those are user-facing help messages.

- [ ] **Step 4: Commit**

```bash
git add backend/dspy_agent.py
git commit -m "refactor: use config validation and logging in dspy_agent"
```

---

## Task 10: Refactor backend/knowledge/enrich_knowledge.py

**Files:**
- Modify: `backend/knowledge/enrich_knowledge.py`

- [ ] **Step 1: Update imports**

Add at top:

```python
import logging

from backend.utils.yaml_parser import parse_index_md
from backend.utils.file_io import safe_read_text

logger = logging.getLogger(__name__)
```

- [ ] **Step 2: Replace frontmatter parsing with utility**

Find the section around lines 16-35 that parses YAML frontmatter and replace with:

```python
    parsed = parse_index_md(md_path)
    frontmatter = parsed["frontmatter"]
    body = parsed["body"]
```

- [ ] **Step 3: Replace print() with logger calls in CLI mode**

Replace `print()` calls with appropriate logger levels:

```python
# For informational messages:
logger.info("Processing file: %s", md_path)

# For dry-run output (keep print since it's CLI output):
if dry_run:
    print(f"Would update: {md_path}")
```

- [ ] **Step 4: Commit**

```bash
git add backend/knowledge/enrich_knowledge.py
git commit -m "refactor: use shared utilities in enrich_knowledge"
```

---

## Task 11: Refactor backend/skills/skills.py - Add Logging

**Files:**
- Modify: `backend/skills/skills.py`

- [ ] **Step 1: Add logging imports**

Add at top:

```python
import logging

logger = logging.getLogger(__name__)
```

- [ ] **Step 2: Add logging to _extract_description exception handlers**

Find the function around lines 20-35 and update exception handlers:

```python
def _extract_description(skill_path: Path) -> str:
    """Extract description from SKILL.md frontmatter or first paragraph."""
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return ""
    
    try:
        content = skill_md.read_text(encoding="utf-8")
    except OSError as e:
        logger.warning(f"Failed to read {skill_md}: {e}")
        return ""
    
    # Try YAML frontmatter first
    if content.startswith("---"):
        try:
            end = content.find("---", 3)
            if end > 0:
                fm = yaml.safe_load(content[3:end])
                if fm and "description" in fm:
                    return fm["description"]
        except (yaml.YAMLError, ValueError) as e:
            logger.warning(f"Failed to parse YAML in {skill_md}: {e}")
    
    # Fallback: first non-empty paragraph
    for line in content.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            return stripped
    
    return ""
```

- [ ] **Step 3: Add logging to read_skill_file exception handler**

Find exception handler around line 61-64 and update:

```python
    except Exception as e:
        logger.error(f"Failed to read skill file {rel_path}: {e}", exc_info=True)
        return {
            "path": rel_path,
            "error": f"Error: Failed to read file - {str(e)}",
        }
```

- [ ] **Step 4: Commit**

```bash
git add backend/skills/skills.py
git commit -m "refactor: add logging to exception handlers in skills.py"
```

---

## Task 12: Sanitize Backend Error Responses

**Files:**
- Modify: `backend/server.py`

- [ ] **Step 1: Create error sanitization helper**

Add near the top after logger configuration:

```python
def _sanitize_error(error: Exception) -> str:
    """Sanitize error message before sending to client."""
    error_str = str(error)
    # Remove absolute paths
    error_str = error_str.replace(str(_HERE.parent), "[PROJECT_ROOT]")
    # Remove potentially sensitive stack trace info
    if "Traceback" in error_str:
        # Just return the error message, not full trace
        lines = error_str.split("\n")
        return lines[-1] if lines else "An error occurred"
    return error_str
```

- [ ] **Step 2: Update HTTPException in read_knowledge_file_endpoint**

Find the exception handler around line 228 and update:

```python
    except FileNotFoundError as e:
        logger.error(f"Knowledge file not found: {rel_path} - {e}")
        raise HTTPException(status_code=404, detail=_sanitize_error(e))
    except Exception as e:
        logger.error(f"Error reading knowledge file {rel_path}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to read knowledge file")
```

- [ ] **Step 3: Update SSE error event in chat_endpoint**

Find the exception handler around line 298 and update:

```python
    except Exception as exc:
        logger.error(f"Chat error: {exc}", exc_info=True)
        error_msg = _sanitize_error(exc)
        event_q.put({"kind": "error", "text": error_msg})
```

- [ ] **Step 4: Commit**

```bash
git add backend/server.py
git commit -m "feat: sanitize error messages before sending to client"
```

---

## Task 13: Frontend API Config

**Files:**
- Create: `frontend/src/config/api.ts`

- [ ] **Step 1: Create API config file**

```typescript
/**
 * API configuration constants
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/config/api.ts
git commit -m "feat: add centralized API config"
```

---

## Task 14: Frontend Logger Utility

**Files:**
- Create: `frontend/src/utils/logger.ts`

- [ ] **Step 1: Create logger utility**

```typescript
/**
 * Structured logging utility
 * 
 * Provides consistent logging interface across the application.
 * In development: logs to console with formatting
 * In production: could send to monitoring service (future enhancement)
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

function sanitizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      // Don't include stack in production to avoid leaking sensitive info
      ...(import.meta.env.DEV && { stack: error.stack }),
    };
  }
  return { error: String(error) };
}

function log(level: LogLevel, message: string, data?: unknown): void {
  const entry: LogEntry = {
    level,
    message,
    data: data !== undefined ? (data instanceof Error ? sanitizeError(data) : data) : undefined,
    timestamp: new Date().toISOString(),
  };

  // In development, log to console with nice formatting
  if (import.meta.env.DEV) {
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
    switch (level) {
      case "error":
        console.error(prefix, message, entry.data || "");
        break;
      case "warn":
        console.warn(prefix, message, entry.data || "");
        break;
      case "info":
        console.info(prefix, message, entry.data || "");
        break;
      case "debug":
        console.debug(prefix, message, entry.data || "");
        break;
    }
  } else {
    // In production, only log errors to console
    // Future: send to monitoring service
    if (level === "error") {
      console.error(message, entry.data);
    }
  }
}

export const logger = {
  error: (message: string, error?: unknown) => log("error", message, error),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  info: (message: string, data?: unknown) => log("info", message, data),
  debug: (message: string, data?: unknown) => log("debug", message, data),
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils/logger.ts
git commit -m "feat: add structured logging utility"
```

---

## Task 15: Frontend API Fetch Helper

**Files:**
- Create: `frontend/src/utils/api.ts`

- [ ] **Step 1: Create API fetch helper**

```typescript
/**
 * API fetch utilities
 */
import { logger } from "./logger";
import { API_BASE } from "../config/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch JSON data from API endpoint with error handling
 * 
 * @param endpoint - API endpoint path (e.g., "/api/skills")
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws ApiError if request fails
 */
export async function fetchJson<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = new ApiError(
        `Failed to fetch ${endpoint}: ${response.statusText}`,
        response.status,
        response.statusText
      );
      logger.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
    
    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network error or JSON parse error
    logger.error(`API request error: ${endpoint}`, error);
    throw new ApiError(
      `Network error: ${error instanceof Error ? error.message : String(error)}`,
      0,
      "Network Error"
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils/api.ts
git commit -m "feat: add API fetch helper utility"
```

---

## Task 16: Frontend API State Hook

**Files:**
- Create: `frontend/src/hooks/useApiState.ts`

- [ ] **Step 1: Create API state hook**

```typescript
/**
 * Reusable loading/error state management for API calls
 */
import { useState } from "react";

interface ApiState {
  loading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetError: () => void;
}

/**
 * Hook for managing loading and error state in API calls
 * 
 * @returns Object with loading/error state and setters
 */
export function useApiState(): ApiState {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const resetError = () => setError(null);

  return {
    loading,
    error,
    setLoading,
    setError,
    resetError,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useApiState.ts
git commit -m "feat: add API state management hook"
```

---

## Task 17: Refactor frontend/src/hooks/useKnowledge.ts

**Files:**
- Modify: `frontend/src/hooks/useKnowledge.ts`

- [ ] **Step 1: Update imports and refactor to use new utilities**

Replace entire file with:

```typescript
import { useState, useEffect } from "react";
import type { KnowledgeTree } from "../types/api";
import { fetchJson } from "../utils/api";
import { useApiState } from "./useApiState";

export function useKnowledge() {
  const [tree, setTree] = useState<KnowledgeTree | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const { loading, error, setLoading, setError } = useApiState();

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchJson<KnowledgeTree>("/api/knowledge/tree")
      .then((data) => {
        setTree(data);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const toggleFolder = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectFile = (path: string) => {
    setSelectedPath(path);
  };

  return {
    tree,
    expanded,
    selectedPath,
    loading,
    error,
    toggleFolder,
    selectFile,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useKnowledge.ts
git commit -m "refactor: use shared utilities in useKnowledge hook"
```

---

## Task 18: Refactor frontend/src/hooks/useSkills.ts

**Files:**
- Modify: `frontend/src/hooks/useSkills.ts`

- [ ] **Step 1: Refactor to use new utilities**

Replace entire file with:

```typescript
import { useState, useEffect } from "react";
import type { Skill } from "../types/api";
import { fetchJson } from "../utils/api";
import { useApiState } from "./useApiState";

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const { loading, error, setLoading, setError } = useApiState();

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchJson<Skill[]>("/api/skills")
      .then((data) => {
        setSkills(data);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { skills, loading, error };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useSkills.ts
git commit -m "refactor: use shared utilities in useSkills hook"
```

---

## Task 19: Refactor frontend/src/hooks/useConfig.ts

**Files:**
- Modify: `frontend/src/hooks/useConfig.ts`

- [ ] **Step 1: Update to use new utilities**

Update imports and refactor to use fetchJson and logger:

```typescript
import { useState, useEffect } from "react";
import type { Config } from "../types/api";
import { fetchJson } from "../utils/api";
import { logger } from "../utils/logger";

export function useConfig() {
  const [config, setConfig] = useState<Config>({
    llmModel: "",
    llmProvider: "",
    thinkingEnabled: false,
  });

  useEffect(() => {
    fetchJson<{ llm_model: string; llm_provider: string }>("/api/config")
      .then((data) => {
        setConfig({
          llmModel: data.llm_model || "",
          llmProvider: data.llm_provider || "",
          thinkingEnabled: false,
        });
      })
      .catch((err) => {
        logger.error("Failed to load config", err);
      });
  }, []);

  const setThinkingEnabled = (enabled: boolean) => {
    setConfig((prev) => ({ ...prev, thinkingEnabled: enabled }));
  };

  return { config, setThinkingEnabled };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useConfig.ts
git commit -m "refactor: use shared utilities in useConfig hook"
```

---

## Task 20: Refactor frontend/src/hooks/useConversations.ts

**Files:**
- Modify: `frontend/src/hooks/useConversations.ts`

- [ ] **Step 1: Update to use logger utility**

Find the console.error calls and replace with logger:

```typescript
import { logger } from "../utils/logger";

// Replace line ~26:
      .catch((err) => {
        logger.error("Failed to load conversations", err);
        setConversations([]);
      });

// Replace line ~49:
      .catch((err) => {
        logger.error("Failed to delete conversation", err);
      });
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useConversations.ts
git commit -m "refactor: use logger in useConversations hook"
```

---

## Task 21: Refactor frontend/src/hooks/useChat.ts

**Files:**
- Modify: `frontend/src/hooks/useChat.ts`

- [ ] **Step 1: Update imports to use API_BASE**

Replace the API_BASE constant with import:

```typescript
import { API_BASE } from "../config/api";
```

Remove the local constant definition.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useChat.ts
git commit -m "refactor: use centralized API config in useChat"
```

---

## Task 22: Refactor frontend/src/components/knowledge/FilePreview.tsx

**Files:**
- Modify: `frontend/src/components/knowledge/FilePreview.tsx`

- [ ] **Step 1: Update to use new utilities**

Update imports:

```typescript
import { API_BASE } from "../../config/api";
import { logger } from "../../utils/logger";
import { useApiState } from "../../hooks/useApiState";
```

- [ ] **Step 2: Replace local state with useApiState**

Replace the loading and error useState calls:

```typescript
const { loading, error, setLoading, setError } = useApiState();
```

Remove the local `const [loading, setLoading]` and `const [error, setError]` lines.

- [ ] **Step 3: Replace console.error with logger**

Find the console.error call around line 135 and replace:

```typescript
      .catch((err) => {
        logger.error("Failed to load file content", err);
        setError(err.message);
        setLoading(false);
      });
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/knowledge/FilePreview.tsx
git commit -m "refactor: use shared utilities in FilePreview"
```

---

## Task 23: Verification and Testing

**Files:**
- All modified files

- [ ] **Step 1: Run backend tests**

```bash
pytest -v
```

Expected: All tests pass (existing tests should continue working)

- [ ] **Step 2: Run frontend build**

```bash
cd frontend
npm run build
```

Expected: Build succeeds with 0 errors

- [ ] **Step 3: Run frontend tests**

```bash
cd frontend
npm test
```

Expected: All tests pass

- [ ] **Step 4: Run frontend linter**

```bash
cd frontend
npm run lint
```

Expected: No linting errors

- [ ] **Step 5: Start backend server**

```bash
uv run uvicorn backend.server:app --reload --port 8000
```

Expected: Server starts without errors, logging output visible

- [ ] **Step 6: Start frontend dev server**

```bash
cd frontend
npm run dev
```

Expected: Frontend starts on port 5173

- [ ] **Step 7: Manual smoke test**

Open http://localhost:5173 and verify:
- [ ] Chat interface loads
- [ ] Knowledge tree loads in sidebar
- [ ] Skills panel loads
- [ ] Can send a chat message
- [ ] Can click on knowledge file and see preview
- [ ] No console errors in browser dev tools
- [ ] Backend logs show structured logging format

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: complete code audit fixes verification"
```

---

## Summary

This plan creates 8 new utility modules and refactors 15+ existing files to eliminate duplication and improve consistency. The changes address issues #13-20 and #26-30 from the code audit:

**Backend improvements:**
- Centralized YAML parsing (eliminates 3 duplicate implementations)
- Centralized config validation (eliminates 2 duplicate implementations)
- Centralized path security checks (eliminates 2 duplicate implementations)
- Safe file reading utility (replaces 12+ scattered calls)
- Structured logging throughout
- Sanitized error responses to client

**Frontend improvements:**
- Centralized API config (eliminates 5 duplicate constants)
- Structured logging service (replaces 7 console.error calls)
- Reusable fetch helper (eliminates 3 duplicate patterns)
- Reusable state management hook (eliminates 3 duplicate patterns)

All changes are backwards compatible and maintain existing functionality while improving code quality and maintainability.
