# Code Audit Fixes Design

**Date**: 2026-06-04  
**Scope**: Refactoring fixes for issues #13-20, #26-30 from code audit  
**Goal**: Eliminate duplication, improve consistency, and establish shared utilities

## Overview

This refactoring creates shared utility modules to eliminate code duplication and inconsistency identified in the code audit. The changes span both backend (Python) and frontend (TypeScript) codebases.

## Backend Changes

### 1. YAML Parsing Utility (`backend/utils/yaml_parser.py`)

**Purpose**: Consolidate duplicate frontmatter parsing logic (Issues #13, #18)

**Functions**:
- `parse_index_md(path: Path) -> dict[str, Any]`: Parse YAML frontmatter from markdown files
  - Returns `{"frontmatter": dict, "body": str}`
  - Handles missing files, invalid YAML gracefully
  - Uses new `safe_read_text()` helper

**Impact**:
- Removes duplicate code from `backend/server.py:80-95` and `backend/knowledge/knowledge.py:14-29`
- Removes duplicate code from `backend/knowledge/enrich_knowledge.py:16-35`

### 2. Config Validation Utility (`backend/utils/config.py`)

**Purpose**: Centralize environment variable validation (Issue #14)

**Functions**:
- `validate_llm_config(provider: str | None, model: str | None, api_key: str | None) -> tuple[str, str, str]`
  - Validates required LLM configuration
  - Returns (provider, model, api_key) tuple
  - Raises descriptive ValueError if invalid

**Impact**:
- Removes duplicate validation from `backend/utils/llm.py:61-75` and `backend/dspy_agent.py:208-220`
- Centralizes error messages for consistency

### 3. Path Security Utility (`backend/utils/path_security.py`)

**Purpose**: Centralize path traversal protection (Issue #19)

**Functions**:
- `validate_safe_path(path: Path, root: Path) -> None`
  - Checks if resolved path is within root directory
  - Raises ValueError if path escapes root (path traversal attack)

**Impact**:
- Removes duplicate security checks from `backend/knowledge/knowledge.py:51-55` and `:101-105`
- Ensures consistent security validation

### 4. File I/O Utility (`backend/utils/file_io.py`)

**Purpose**: Standardize file reading with error handling (Issue #20)

**Functions**:
- `safe_read_text(path: Path, encoding: str = "utf-8") -> str`
  - Reads file with consistent error handling
  - Logs errors before raising
  - Returns empty string or raises FileNotFoundError

**Impact**:
- Replaces 12+ scattered `.read_text()` calls across backend
- Consistent error logging

### 5. Logging Standardization (Issues #27, #28, #29, #30)

**Changes**:
- Configure Python `logging` module in `backend/server.py` startup
- Replace all `print()` calls with `logger.info()` / `logger.debug()`
- Add logging for silent exception handlers in:
  - `backend/server.py:78,87,97`
  - `backend/skills/skills.py:28,33`
- Standardize error handling: always raise exceptions (Issue #29)
- Sanitize exceptions before sending to client (Issue #30):
  - `backend/server.py:228` - sanitize HTTPException details
  - `backend/server.py:298` - sanitize SSE error events

**Pattern**:
```python
import logging
logger = logging.getLogger(__name__)

try:
    # operation
except Exception as e:
    logger.error(f"Operation failed: {e}", exc_info=True)
    raise  # or return sanitized error
```

## Frontend Changes

### 1. API Configuration (`frontend/src/config/api.ts`)

**Purpose**: Single source for API base URL (Issue #15)

**Export**:
```typescript
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
```

**Impact**:
- Removes duplication from 5 files: `useChat.ts`, `useKnowledge.ts`, `useSkills.ts`, `useConfig.ts`, `FilePreview.tsx`

### 2. API State Hook (`frontend/src/hooks/useApiState.ts`)

**Purpose**: Reusable loading/error state management (Issue #16)

**Interface**:
```typescript
export function useApiState() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  return { loading, error, setLoading, setError };
}
```

**Impact**:
- Reduces duplication in `useKnowledge.ts:10-11`, `useSkills.ts:8-9`, `FilePreview.tsx:100-101`

### 3. API Fetch Helper (`frontend/src/utils/api.ts`)

**Purpose**: Consolidate fetch-then-catch pattern (Issue #17)

**Functions**:
```typescript
export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T>
```
- Handles fetch → res.ok check → json() parsing
- Throws descriptive errors
- Logs errors via logger

**Impact**:
- Removes duplicate fetch chains from `useKnowledge.ts:14-28`, `useSkills.ts:12-24`, `useConfig.ts:20-23`

### 4. Logging Service (`frontend/src/utils/logger.ts`)

**Purpose**: Structured logging to replace console.* calls (Issue #26)

**Interface**:
```typescript
export const logger = {
  error: (message: string, error?: unknown) => void,
  warn: (message: string, data?: unknown) => void,
  info: (message: string, data?: unknown) => void,
  debug: (message: string, data?: unknown) => void,
};
```

**Behavior**:
- Development: logs to console with formatting
- Production: could send to monitoring service (future)
- Sanitizes error objects to prevent sensitive data leaks

**Impact**:
- Replaces 7 `console.error()` calls: `FilePreview.tsx:135`, `useSkills.ts:21`, `useConfig.ts:23,38`, `useKnowledge.ts:24`, `useConversations.ts:26,49`

## Migration Strategy

1. Create all new utility modules
2. Update imports in existing files
3. Replace duplicated code with utility calls
4. Verify tests still pass
5. Run linters to catch any issues

## Testing

- All existing tests should continue to pass
- No new test files required (utilities are tested through existing integration tests)
- Manual verification: start server, load frontend, test chat/knowledge/skills flows

## File Changes Summary

**New files** (8):
- `backend/utils/yaml_parser.py`
- `backend/utils/config.py`
- `backend/utils/path_security.py`
- `backend/utils/file_io.py`
- `frontend/src/config/api.ts`
- `frontend/src/hooks/useApiState.ts`
- `frontend/src/utils/api.ts`
- `frontend/src/utils/logger.ts`

**Modified files** (15+):
- Backend: `server.py`, `dspy_agent.py`, `utils/llm.py`, `knowledge/knowledge.py`, `knowledge/enrich_knowledge.py`, `skills/skills.py`
- Frontend: `hooks/useChat.ts`, `hooks/useKnowledge.ts`, `hooks/useSkills.ts`, `hooks/useConfig.ts`, `hooks/useConversations.ts`, `components/knowledge/FilePreview.tsx`, and others using console.error

## Success Criteria

- No duplicate code for the targeted patterns
- Consistent error handling and logging throughout
- All existing tests pass
- Frontend and backend run without errors
- Code audit findings #13-20, #26-30 are resolved
