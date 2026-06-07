# Docker Containerization Design

**Date:** 2026-06-07  
**Status:** Approved

## Overview

Containerize the Skilled Agent application into two separate Docker containers (backend and frontend) orchestrated via Docker Compose, with volume mounts for live development.

## Goals

- Separate backend (Python/FastAPI) and frontend (React/Vite) into distinct containers
- Enable live editing of code, knowledge base, and skills without rebuilding containers
- Use Docker networking for inter-container communication
- Maintain development-friendly workflow with hot reload

## Architecture

### Container Structure

**Backend Container:**
- Base image: `python:3.11-slim`
- Service: FastAPI server with DSPy agent
- Port: 8000
- Volumes: `.env`, `knowledge/`, `skills/`, `knowledge_graph`, `backend/`

**Frontend Container:**
- Base image: `node:20-slim`
- Service: Vite dev server
- Port: 5173 (exposed as 3000 on host)
- Volumes: `src/`, `public/`

**Networking:**
- Custom bridge network: `app-network`
- Frontend → Backend: `http://backend:8000` (internal Docker DNS)
- Host → Frontend: `http://localhost:3000`
- Host → Backend: `http://localhost:8000`

### Build Context Strategy

Use **focused build contexts** for better build performance and caching:

- Backend context: `./backend`
- Frontend context: `./frontend`
- No global `.dockerignore` needed (each context is isolated)

## Implementation Details

### Backend Dockerfile

**Location:** `backend/Dockerfile`

**Key features:**
- Install system build tools for Python packages requiring compilation
- Copy `requirements.txt` from backend directory
- Install Python dependencies with pip
- Copy backend code
- Run uvicorn with `--reload` and `--host 0.0.0.0`

**Build context:** `./backend`

### Frontend Dockerfile

**Location:** `frontend/Dockerfile`

**Key features:**
- Use `npm ci` for reproducible installs
- Copy package files first (better layer caching)
- Copy frontend code
- Run Vite dev server with `--host 0.0.0.0`

**Build context:** `./frontend`

### Docker Compose Configuration

**Location:** `docker-compose.yml` (root)

**Backend service:**
- Build from `./backend` context
- Expose port 8000
- Mount volumes (read-only where appropriate):
  - `.env` (read-only)
  - `knowledge/` (read-only)
  - `skills/` (read-only)
  - `knowledge_graph` (read-write)
  - `backend/` (read-write, for hot reload)
- Set `PYTHONUNBUFFERED=1` for logging
- Connect to `app-network`

**Frontend service:**
- Build from `./frontend` context
- Expose port 5173 → host port 3000
- Mount volumes:
  - `src/` (for HMR)
  - `public/` (for static assets)
- Set `VITE_API_BASE_URL=http://backend:8000`
- Depends on backend service
- Connect to `app-network`

**Network:**
- Custom bridge network for container isolation

### Volume Strategy

**Development-focused approach:**

1. **Code volumes:** Enable hot reload
   - `./backend:/app/backend` → uvicorn auto-reloads on changes
   - `./frontend/src:/app/src` → Vite HMR updates browser

2. **Content volumes:** Live editing without rebuild
   - `./knowledge:/app/knowledge:ro` → markdown files available immediately
   - `./skills:/app/skills:ro` → Python skills available immediately
   - `./knowledge_graph:/app/knowledge_graph` → persistent vector embeddings

3. **Configuration volumes:**
   - `./.env:/app/.env:ro` → secrets stay on host, not in image

### Environment Variables

**Backend:**
- Load from mounted `.env` file (via python-dotenv)
- Contains: `LLM_PROVIDER`, `LLM_MODEL`, `LITELLM_BASE_URL`, `LITELLM_API_KEY`

**Frontend:**
- `VITE_API_BASE_URL=http://backend:8000` (set in docker-compose)
- Overrides default `http://localhost:8000` for container networking

## Prerequisites

**Before building:**
1. Copy `requirements.txt` to `backend/` directory:
   ```bash
   cp requirements.txt backend/requirements.txt
   ```

**System requirements:**
- Docker 20.10+
- Docker Compose 2.0+

## Usage

### Starting the Application

```bash
# Build and start containers
docker-compose up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Development Workflow

**Live editing:**
- Edit `backend/*.py` → uvicorn reloads automatically
- Edit `frontend/src/**` → Vite HMR updates browser
- Edit `knowledge/*.md` → changes available immediately
- Edit `skills/*.py` → changes available immediately

**Accessing services:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Backend API docs: http://localhost:8000/docs

### Stopping and Cleanup

```bash
# Stop containers (preserves data)
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Rebuild from scratch
docker-compose up --build --force-recreate
```

## File Structure

```
.
├── docker-compose.yml           # Orchestration
├── backend/
│   ├── Dockerfile              # Backend container definition
│   ├── requirements.txt        # Python dependencies (copied from root)
│   └── ...                     # Backend code
├── frontend/
│   ├── Dockerfile              # Frontend container definition
│   └── ...                     # Frontend code
├── knowledge/                   # Mounted as volume
├── skills/                      # Mounted as volume
├── knowledge_graph             # Mounted as volume
└── .env                        # Mounted as volume
```

## Trade-offs

**Advantages:**
- ✅ Simple, straightforward setup
- ✅ Development-friendly with hot reload
- ✅ Live editing of knowledge and skills
- ✅ Clear separation of backend and frontend
- ✅ Better build caching (focused contexts)
- ✅ Secrets stay out of images

**Limitations:**
- ⚠️ Not production-optimized (dev servers, larger images)
- ⚠️ Includes dev dependencies in images
- ⚠️ Vite dev server less performant than production build

**Future optimizations:**
- Add multi-stage Dockerfiles for production
- Create `docker-compose.prod.yml` with optimized builds
- Use nginx to serve frontend static assets
- Implement health checks
- Add container resource limits

## Security Considerations

- `.env` mounted as read-only to prevent accidental modification
- `knowledge/` and `skills/` mounted as read-only (backend only reads)
- API keys never baked into images
- Containers run as non-root (future enhancement)

## Testing Plan

1. Build containers: `docker-compose build`
2. Start services: `docker-compose up -d`
3. Verify backend health: `curl http://localhost:8000/api/knowledge/tree`
4. Verify frontend loads: Open `http://localhost:3000` in browser
5. Test hot reload: Edit a backend file, verify uvicorn reloads
6. Test HMR: Edit a frontend component, verify browser updates
7. Test knowledge mount: Edit a markdown file, verify changes reflected
8. Test skills mount: Edit a skill, verify changes reflected
9. Verify logs: `docker-compose logs`
10. Clean shutdown: `docker-compose down`

## Success Criteria

- ✅ Backend container builds successfully
- ✅ Frontend container builds successfully
- ✅ Services communicate via Docker network
- ✅ Hot reload works for backend code changes
- ✅ HMR works for frontend code changes
- ✅ Knowledge and skills are accessible without rebuild
- ✅ Environment variables loaded correctly
- ✅ Clear, documented workflow for developers
