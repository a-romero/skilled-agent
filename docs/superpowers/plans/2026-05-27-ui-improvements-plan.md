# UI Improvements Plan

## Issues to Address

1. **File preview navigation**: Currently opens in separate area, should be embedded side-by-side with tree
2. **Knowledge pane header**: Missing "Knowledge" title and has unnecessary "Select a file to preview" text
3. **Conversation history**: Lost capability to log/manage multiple conversations with starters
4. **Model configuration**: Settings panel doesn't do anything and should be removed
5. **Skill selection**: Needs verification if backend supports it

## Changes Required

### 1. Fix Knowledge Pane Layout
- Add header with "Knowledge" title and badge
- Keep tree and preview side-by-side (already correct in structure)
- Remove "Select a file to preview" placeholder text
- Add CSS for `.kpane-header` styling

### 2. Add Conversation History Sidebar
- Create new `ConversationHistory` component
- Add conversation list with localStorage persistence
- Add "New conversation" button
- Add 4 conversation starters for new chats
- Update App.tsx to have 4-pane layout (history, knowledge, skills, chat)

### 3. Remove Model Configuration Panel
- Keep only Skills selection in SkillsPanel
- Remove model/temperature/max_tokens controls
- Simplify useConfig hook to only manage skills

### 4. Verify Skill Selection
Backend investigation needed:
- Check if `backend/dspy_agent.py` consumes `config.skills` from request
- If not, document what's required to wire it up

## Implementation Tasks

### Task A: Fix Knowledge Pane Header and Layout
**Files:**
- Modify: `frontend/src/components/knowledge/KnowledgePane.tsx`
- Modify: `frontend/src/styles/meridian.css`

### Task B: Remove Model Configuration
**Files:**
- Modify: `frontend/src/components/skills/SkillsPanel.tsx`
- Modify: `frontend/src/hooks/useConfig.ts`
- Modify: `frontend/src/types/api.ts`

### Task C: Add Conversation History
**Files:**
- Create: `frontend/src/components/history/ConversationHistory.tsx`
- Create: `frontend/src/hooks/useConversations.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/hooks/useChat.ts` (add persistence)

### Task D: Backend Skill Selection Investigation
**Files:**
- Read: `backend/dspy_agent.py`
- Document findings and requirements
