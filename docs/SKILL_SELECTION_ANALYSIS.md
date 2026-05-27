# Backend Skill Selection Analysis

## Current State

### Frontend
The frontend sends a `config` object in the chat request body:
```typescript
{
  question: string,
  history: Array<{role: string, content: string}>,
  config?: {
    model?: string,
    temperature?: number,
    max_tokens?: number,
    skills?: string[]
  }
}
```

### Backend
**server.py** (`/api/chat` endpoint, line 241):
- Receives the request body
- Extracts only `question` and `history`
- **Does NOT extract or use `config`**
- Calls `dspy_agent.run_agent(task, verbose, event_callback, history)`

**dspy_agent.py** (`run_agent` function, line 300):
```python
def run_agent(
    task: str,
    verbose: bool = True,
    event_callback: Callable[[dict], None] | None = None,
    history: list[dict] | None = None,
) -> str:
```
- **Does NOT accept a `config` parameter**
- Hardcodes skill loading: `skill_registry = build_skill_registry(SKILLS_ROOT)`
- Makes all skills available to the agent via tool functions

## What's Required to Support Skill Selection

### Option A: Filter Skills (Recommended - Simple)

**Changes needed:**

1. **Update `server.py` line ~245**:
```python
body = await request.json()
question: str = body.get("question", "").strip()
history: list[dict] = body.get("history", [])[-6:]
config: dict = body.get("config", {})  # NEW: Extract config
selected_skills: list[str] | None = config.get("skills")  # NEW
```

2. **Update `server.py` line ~267** (where `run_agent` is called):
```python
answer = dspy_agent.run_agent(
    task=question,
    verbose=False,
    event_callback=on_event,
    history=history,
    selected_skills=selected_skills,  # NEW: Pass selected skills
)
```

3. **Update `dspy_agent.py` line ~300** (function signature):
```python
def run_agent(
    task: str,
    verbose: bool = True,
    event_callback: Callable[[dict], None] | None = None,
    history: list[dict] | None = None,
    selected_skills: list[str] | None = None,  # NEW
) -> str:
```

4. **Update `dspy_agent.py` line ~316** (skill loading):
```python
skill_registry = build_skill_registry(SKILLS_ROOT)

# NEW: Filter skills if specified
if selected_skills is not None:
    skill_registry = {
        name: meta
        for name, meta in skill_registry.items()
        if name in selected_skills
    }

list_skills_tool, read_skill_tool = _make_skill_tools(skill_registry, event_callback)
```

**Pros:**
- Simple 4-line change
- Skills are still loaded but filtered before creating tools
- Falls back to all skills if none selected

**Cons:**
- Still loads all skill files from disk even if not used

### Option B: Dynamic Skill Loading (Advanced)

Modify `build_skill_registry` to accept an optional `filter` parameter and only load specified skills from disk.

**Pros:**
- More efficient (doesn't load unused skills)

**Cons:**
- More complex changes across multiple functions
- May break if skill dependencies exist

## Recommendation

**Use Option A** for now:
- Simple to implement (4 locations, ~10 lines total)
- Maintains backward compatibility (defaults to all skills)
- Can optimize later if performance becomes an issue

## Testing

After implementing:
1. Frontend: Select 1-2 skills, send message
2. Backend: Should only create tools for selected skills
3. Agent: Should only list/use selected skills in reasoning

## Model/Temperature/Max_Tokens Support

Currently **NOT supported**. Would require:
- Modifying `_build_lm()` function in `dspy_agent.py` (line ~290)
- Passing config parameters through to DSPy LM initialization
- More complex as it involves DSPy's LM configuration

**Recommendation: Remove from frontend** as noted in user feedback.
