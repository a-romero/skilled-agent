# Model Configuration Summary

## Backend Configuration (`.env` at project root)

The backend reads model configuration from **`./.env`** file:

```env
LLM_PROVIDER=litellm
LLM_MODEL=openai-gpt-oss-120b
LITELLM_BASE_URL=<your-litellm-proxy-url>
LITELLM_API_KEY=openai
```

### Environment Variables Used

**Required:**
- `LLM_PROVIDER` - Either `anthropic` or `litellm`
- `LLM_MODEL` - Model identifier (e.g., `claude-sonnet-4`, `openai-gpt-oss-120b`)

**For Anthropic:**
- `ANTHROPIC_API_KEY` - Your Anthropic API key

**For LiteLLM:**
- `LITELLM_BASE_URL` - Your LiteLLM proxy URL
- `LITELLM_API_KEY` - API key for proxy (default: "openai")

**Optional:**
- `OVA_USER` - Display name for user (default: "Anonymous")
- `OVA_ORG` - Organization name (default: "Anonymous")

## Frontend Configuration (`.env` files in `frontend/`)

The frontend has **two** .env files:

### `frontend/.env.development`
```env
VITE_API_BASE_URL=http://localhost:8000
```
Used during `npm run dev` (development mode)

### `frontend/.env`
```env
VITE_API_BASE_URL=http://localhost:8000
```
Fallback for all environments

**Note:** `.env.development` takes precedence in dev mode.

## Current Setup

Based on your `./.env` file:

```
Backend Model: openai-gpt-oss-120b (via LiteLLM)
Provider: litellm
```

The frontend now **fetches this dynamically** from `/api/config` and displays it at the bottom of the chat input.

## What Changed

### Before
- Model name was **hardcoded** as `claude-sonnet-4` in the frontend
- No connection to actual backend configuration

### After
- Frontend fetches `/api/config` on load
- Displays the **actual model** from backend .env
- Also displays user name and org if configured
- Model name appears at bottom of chat input: `⚡ openai-gpt-oss-120b`

## How to Change the Model

### Option 1: Edit `./.env` (Backend)

Change the model in the root `.env` file:

```env
# For Anthropic Claude
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4
ANTHROPIC_API_KEY=your-key-here

# OR for LiteLLM proxy
LLM_PROVIDER=litellm
LLM_MODEL=your-model-name
LITELLM_BASE_URL=https://your-proxy.com
LITELLM_API_KEY=your-key
```

Then **restart the backend**:
```bash
# Stop backend (Ctrl+C)
uvicorn backend.server:app --reload --port 8000
```

The frontend will automatically fetch and display the new model name.

### Option 2: Set Environment Variables

Instead of using `.env`, you can set environment variables directly:

```bash
export LLM_PROVIDER=anthropic
export LLM_MODEL=claude-sonnet-4
export ANTHROPIC_API_KEY=your-key

uvicorn backend.server:app --reload --port 8000
```

## Testing

After changing the model:

1. **Restart backend** (uvicorn)
2. **Hard refresh frontend** (Cmd+Shift+R)
3. Check the chat input bottom - should show new model name
4. Send a message - should use the new model

## Frontend Configuration Priority

For `VITE_API_BASE_URL`:

1. `.env.development` (highest priority in dev mode)
2. `.env` (fallback)
3. Hardcoded default: `http://localhost:8000`

## Where Files Are Located

```
project-root/
├── .env                          ← Backend config (LLM_PROVIDER, LLM_MODEL)
├── backend/
│   ├── server.py                 ← /api/config endpoint
│   └── dspy_agent.py             ← _build_lm() reads LLM_* vars
└── frontend/
    ├── .env                      ← Frontend fallback
    ├── .env.development          ← Frontend dev mode (overrides .env)
    └── src/
        └── hooks/
            └── useConfig.ts      ← Fetches /api/config
```

## Summary

✅ **Model name now shows actual backend configuration**  
✅ **Fetched dynamically from `/api/config` endpoint**  
✅ **Change model by editing `./.env` and restarting backend**  
✅ **User name and org also configurable via `.env`**  

The hardcoded `claude-sonnet-4` has been replaced with the real model from your backend configuration: **`openai-gpt-oss-120b`** (via LiteLLM).
