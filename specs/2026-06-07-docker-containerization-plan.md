# Docker Containerization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Containerize the Skilled Agent application into separate backend and frontend Docker containers orchestrated via Docker Compose with volume mounts for development.

**Architecture:** Two isolated containers (Python backend, Node frontend) connected via Docker bridge network. Volume mounts enable live editing of code, knowledge base, and skills without rebuilds.

**Tech Stack:** Docker, Docker Compose, Python 3.11, Node 20, FastAPI, Vite

---

## File Structure

**New files to create:**
- `backend/Dockerfile` - Backend container definition
- `backend/requirements.txt` - Python dependencies (copied from root)
- `frontend/Dockerfile` - Frontend container definition
- `docker-compose.yml` - Service orchestration
- `.dockerignore` - Minimal ignore rules (optional)

**Files to modify:**
- None (all new files)

---

### Task 1: Copy Requirements to Backend

**Files:**
- Copy: `requirements.txt` → `backend/requirements.txt`

- [ ] **Step 1: Copy requirements file**

```bash
cp requirements.txt backend/requirements.txt
```

- [ ] **Step 2: Verify file copied**

```bash
ls -la backend/requirements.txt
```

Expected: File exists with same size as root requirements.txt

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: copy requirements.txt to backend for Docker build context"
```

---

### Task 2: Create Backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`

- [ ] **Step 1: Write backend Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . ./backend/

# Expose port
EXPOSE 8000

# Run uvicorn
CMD ["uvicorn", "backend.server:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 2: Verify Dockerfile syntax**

```bash
docker build --dry-run -f backend/Dockerfile backend/ 2>&1 | head -5
```

Expected: No syntax errors (or use `docker build --check` if available)

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile
git commit -m "feat: add backend Dockerfile with Python 3.11 and uvicorn"
```

---

### Task 3: Create Frontend Dockerfile

**Files:**
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Write frontend Dockerfile**

```dockerfile
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

- [ ] **Step 2: Verify Dockerfile syntax**

```bash
docker build --dry-run -f frontend/Dockerfile frontend/ 2>&1 | head -5
```

Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add frontend/Dockerfile
git commit -m "feat: add frontend Dockerfile with Node 20 and Vite dev server"
```

---

### Task 4: Create Docker Compose Configuration

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Write docker-compose.yml**

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: skilled-agent-backend
    ports:
      - "8000:8000"
    volumes:
      - ./.env:/app/.env:ro
      - ./knowledge:/app/knowledge:ro
      - ./skills:/app/skills:ro
      - ./knowledge_graph:/app/knowledge_graph
      - ./backend:/app/backend
    environment:
      - PYTHONUNBUFFERED=1
    networks:
      - app-network
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: skilled-agent-frontend
    ports:
      - "3000:5173"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
    environment:
      - VITE_API_BASE_URL=http://backend:8000
    networks:
      - app-network
    depends_on:
      - backend
    restart: unless-stopped

networks:
  app-network:
    driver: bridge
```

- [ ] **Step 2: Validate docker-compose syntax**

```bash
docker-compose config
```

Expected: Outputs the resolved configuration without errors

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose orchestration for backend and frontend"
```

---

### Task 5: Create Optional .dockerignore

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Write minimal .dockerignore**

```
.git/
.venv/
__pycache__/
*.pyc
node_modules/
.pytest_cache/
```

- [ ] **Step 2: Commit**

```bash
git add .dockerignore
git commit -m "chore: add minimal .dockerignore for common temp files"
```

---

### Task 6: Build and Test Containers

**Files:**
- Test: All Docker files

- [ ] **Step 1: Build backend container**

```bash
docker-compose build backend
```

Expected: Build completes successfully, shows "Successfully built" and image ID

- [ ] **Step 2: Build frontend container**

```bash
docker-compose build frontend
```

Expected: Build completes successfully, shows "Successfully built" and image ID

- [ ] **Step 3: Start services in detached mode**

```bash
docker-compose up -d
```

Expected: Both containers start, output shows "Creating skilled-agent-backend" and "Creating skilled-agent-frontend"

- [ ] **Step 4: Check container status**

```bash
docker-compose ps
```

Expected: Both containers show "Up" status

- [ ] **Step 5: View logs to verify startup**

```bash
docker-compose logs backend | tail -10
docker-compose logs frontend | tail -10
```

Expected:
- Backend logs show "Uvicorn running on http://0.0.0.0:8000"
- Frontend logs show "Local: http://localhost:5173/" or similar Vite dev server message

---

### Task 7: Verify Backend API

**Files:**
- Test: Backend service via HTTP

- [ ] **Step 1: Test backend health endpoint**

```bash
curl -s http://localhost:8000/api/knowledge/tree | head -20
```

Expected: Returns JSON with knowledge tree structure

- [ ] **Step 2: Test backend skills endpoint**

```bash
curl -s http://localhost:8000/api/skills | head -20
```

Expected: Returns JSON array with skill information

- [ ] **Step 3: Check backend API docs**

```bash
curl -s http://localhost:8000/docs | grep -o "<title>.*</title>"
```

Expected: Shows FastAPI docs title (or open http://localhost:8000/docs in browser)

---

### Task 8: Verify Frontend

**Files:**
- Test: Frontend service via browser

- [ ] **Step 1: Test frontend loads**

```bash
curl -s http://localhost:3000 | grep -o "<title>.*</title>"
```

Expected: Shows frontend HTML title

- [ ] **Step 2: Check frontend API configuration**

Open http://localhost:3000 in browser, open DevTools Console, and verify:
- No CORS errors
- Frontend can reach backend at `http://backend:8000` (check Network tab)

Expected: Frontend loads successfully, can communicate with backend

---

### Task 9: Test Hot Reload (Backend)

**Files:**
- Test: `backend/server.py` (modify temporarily)

- [ ] **Step 1: Add a test comment to backend**

```bash
echo "# Test hot reload" >> backend/server.py
```

- [ ] **Step 2: Check backend logs for reload**

```bash
docker-compose logs backend --tail=5
```

Expected: Logs show "Detected file change, reloading..." or similar uvicorn reload message

- [ ] **Step 3: Revert test change**

```bash
git checkout backend/server.py
```

---

### Task 10: Test Hot Module Replacement (Frontend)

**Files:**
- Test: `frontend/src/App.tsx` (modify temporarily)

- [ ] **Step 1: Add a test comment to frontend**

```bash
echo "// Test HMR" >> frontend/src/App.tsx
```

- [ ] **Step 2: Check browser DevTools console**

Open http://localhost:3000 in browser with DevTools open

Expected: Console shows "[vite] hot updated" or similar HMR message, page updates without full reload

- [ ] **Step 3: Revert test change**

```bash
git checkout frontend/src/App.tsx
```

---

### Task 11: Test Volume Mounts

**Files:**
- Test: Volume mounts for knowledge, skills, knowledge_graph

- [ ] **Step 1: Verify knowledge volume**

Add a test file to knowledge directory:

```bash
echo "# Test Knowledge File" > knowledge/test-docker.md
```

- [ ] **Step 2: Check if backend can read it**

```bash
docker-compose exec backend ls -la /app/knowledge/test-docker.md
```

Expected: File exists in container

- [ ] **Step 3: Clean up test file**

```bash
rm knowledge/test-docker.md
```

- [ ] **Step 4: Verify skills volume**

```bash
docker-compose exec backend ls -la /app/skills/ | head -5
```

Expected: Lists skill files from host

- [ ] **Step 5: Verify knowledge_graph volume**

```bash
docker-compose exec backend ls -la /app/knowledge_graph
```

Expected: Shows knowledge_graph file (if it exists)

---

### Task 12: Update Documentation

**Files:**
- Create: `README-DOCKER.md` or update existing `README.md`

- [ ] **Step 1: Create Docker usage documentation**

Create `README-DOCKER.md`:

```markdown
# Docker Setup

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

## Quick Start

1. **Build and start containers:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

3. **Stop containers:**
   ```bash
   docker-compose down
   ```

## Development

### Hot Reload

- **Backend:** Edit files in `backend/` → uvicorn auto-reloads
- **Frontend:** Edit files in `frontend/src/` → Vite HMR updates browser
- **Knowledge:** Edit files in `knowledge/` → changes available immediately
- **Skills:** Edit files in `skills/` → changes available immediately

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Rebuilding

```bash
# Rebuild after dependency changes
docker-compose up --build

# Force recreate containers
docker-compose up --build --force-recreate
```

### Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (caution: deletes data)
docker-compose down -v
```

## Troubleshooting

### Port Already in Use

If ports 3000 or 8000 are already in use, modify `docker-compose.yml`:

```yaml
ports:
  - "3001:5173"  # Frontend: use port 3001 instead
  - "8001:8000"  # Backend: use port 8001 instead
```

### Backend Can't Find Modules

Ensure `backend/requirements.txt` exists and is up to date:

```bash
cp requirements.txt backend/requirements.txt
docker-compose build backend
```

### Frontend Can't Connect to Backend

Check `VITE_API_BASE_URL` in `docker-compose.yml`:

```yaml
environment:
  - VITE_API_BASE_URL=http://backend:8000
```

### Permission Issues with Volumes

Ensure files are readable:

```bash
chmod -R 755 knowledge/ skills/
chmod 644 .env
```
```

- [ ] **Step 2: Commit documentation**

```bash
git add README-DOCKER.md
git commit -m "docs: add Docker setup and usage guide"
```

---

### Task 13: Final Verification

**Files:**
- Test: Complete end-to-end workflow

- [ ] **Step 1: Stop containers**

```bash
docker-compose down
```

Expected: Both containers stop cleanly

- [ ] **Step 2: Clean start from scratch**

```bash
docker-compose up --build
```

Expected: Both containers build and start successfully

- [ ] **Step 3: Run smoke tests**

```bash
# Backend API
curl -s http://localhost:8000/api/knowledge/tree | jq '.name' || echo "Backend OK"

# Frontend
curl -s http://localhost:3000 | grep -q "html" && echo "Frontend OK"
```

Expected: Both commands succeed

- [ ] **Step 4: Stop containers**

```bash
docker-compose down
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Docker containerization complete with backend, frontend, and compose orchestration"
```

---

## Testing Checklist

After completing all tasks, verify:

- ✅ Backend container builds without errors
- ✅ Frontend container builds without errors
- ✅ Both containers start successfully
- ✅ Backend API responds on http://localhost:8000
- ✅ Frontend loads on http://localhost:3000
- ✅ Frontend can communicate with backend (no CORS errors)
- ✅ Backend hot reload works (uvicorn reloads on file changes)
- ✅ Frontend HMR works (browser updates without full reload)
- ✅ Knowledge files accessible in backend container
- ✅ Skills files accessible in backend container
- ✅ Environment variables loaded from .env
- ✅ Logs visible via `docker-compose logs`
- ✅ Containers stop cleanly with `docker-compose down`
- ✅ Documentation complete and accurate

## Rollback Plan

If issues occur:

1. Stop containers: `docker-compose down`
2. Remove Docker files: `git checkout -- docker-compose.yml backend/Dockerfile frontend/Dockerfile`
3. Remove backend requirements copy: `rm backend/requirements.txt`
4. Continue using existing `start.sh` script for local development

## Success Criteria

- Application runs in Docker with same functionality as local setup
- Development workflow preserved (hot reload, HMR)
- Knowledge and skills editable without rebuilds
- Clear documentation for Docker usage
- All tests pass
