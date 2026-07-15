# BrainWeb.ai

BrainWeb.ai is a multi-agent AI workspace that runs specialized LLM agents against your inputs and automatically weaves their outputs into a live, explorable knowledge graph. Every agent run streams tokens in real time over WebSockets, and every entity or relation an agent extracts is written straight onto a shared graph you can inspect, edit, and grow over time.

It ships as both a web app (FastAPI + Next.js) and a native desktop app (Electron), and it's bring-your-own-key — you plug in a provider API key (Anthropic, OpenAI, or Groq) and BrainWeb.ai routes agent calls through it via [LiteLLM](https://github.com/BerriAI/litellm).

## How it works

1. **Pick or define an agent.** BrainWeb.ai ships with built-in agents (e.g. a Research Agent and a Legal Doc Reviewer) and lets you create custom agents with your own system prompt, input/output schema, and tools.
2. **Run it.** A run is dispatched as a background task and streamed back over a per-run WebSocket channel (`run.started` → `run.token` → `run.finished` / `run.error`), so the frontend can render tokens as they arrive.
3. **Extraction, not just chat.** Every agent is prompted to close its response with a structured JSON block of entities and relations. The orchestrator parses that block out of the streamed response even if the model forgets to fence it properly.
4. **Graph writer.** A background `graph_writer` service consumes finished runs and merges the extracted entities/relations into a persistent graph (`nodes` / `edges` tables), scoped per `project_id`, with mention counts and edge weights so the graph strengthens as you keep working.
5. **Visualize and edit.** The Next.js frontend renders the graph with `@xyflow/react` / `react-force-graph-2d`, and lets you inspect, rename, merge, or delete nodes and edges directly.

## Tech stack

| Layer | Stack |
|---|---|
| Backend | FastAPI, SQLAlchemy (async), Pydantic, WebSockets, LiteLLM |
| Database | SQLite (`aiosqlite`) by default for local dev; `docker-compose.yml` provisions Postgres (`pgvector/pgvector`) + Redis for a production-style setup |
| Frontend | Next.js 16, React 19, TypeScript, `@xyflow/react`, `react-force-graph-2d`, `react-markdown` |
| Desktop | Electron, wrapping the built Next.js static export + a PyInstaller-built FastAPI binary as a thin client |
| Auth to LLMs | Bring-your-own-key, encrypted at rest (`cryptography`), routed through LiteLLM to Anthropic / OpenAI / Groq |

## Project structure

```
BrainWeb.ai/
├── backend/
│   ├── main.py              # FastAPI app entrypoint + lifespan (DB init, graph writer task)
│   ├── models.py            # SQLAlchemy models: UserSettings, CustomAgent, Node, Edge
│   ├── database.py          # Async engine/session (SQLite by default, DATABASE_URL override)
│   ├── api/routes.py        # REST + WebSocket routes (agents, runs, settings, graph)
│   ├── core/
│   │   ├── orchestrator.py  # Built-in agents + LiteLLM-backed run loop
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   └── security.py      # API key encryption/decryption/masking
│   ├── services/
│   │   ├── graph_writer.py  # Background consumer that writes agent output into the graph
│   │   └── pubsub.py        # Event pub/sub backing the run WebSocket stream
│   └── build.py, *.spec     # PyInstaller packaging for the desktop build
├── frontend/                # Next.js app (graph canvas, agent runner UI, settings)
├── desktop/                 # Electron shell that wraps the frontend + bundled backend binary
└── docker-compose.yml       # Postgres (pgvector) + Redis for a hosted-style setup
```

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+
- An API key from at least one supported provider: Anthropic, OpenAI, or Groq

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py                 # serves on http://localhost:8000
```

By default this uses a local SQLite file (`brainweb_data.db`). To point at Postgres instead, spin up the bundled services and set `DATABASE_URL`:

```bash
docker compose up -d           # postgres (pgvector) + redis
export DATABASE_URL=postgresql+asyncpg://ingot:password@localhost:5432/ingot_db
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                    # serves on http://localhost:3000
```

### 3. Connect a provider

Open the app, go to Settings, and add an API key for Anthropic, OpenAI, or Groq. Keys are encrypted before they're stored. Agent runs will 403 with `api_key_required` until at least one provider is configured.

### 4. Desktop build (optional)

The desktop app packages the FastAPI backend into a standalone binary (via PyInstaller) and the frontend into a static export, then wraps both in Electron:

```bash
cd backend
python build.py                # produces backend/dist/brainweb-backend(.exe)

cd ../frontend
npm run build                  # static export into frontend/out

cd ../desktop
npm install
npm run dist                   # produces a packaged app (nsis / dmg / AppImage)
```

## API overview

- `GET /agents` · `POST/PUT/DELETE /agents/custom/{id}` — list built-in agents, manage custom ones
- `POST /agents/run` — kick off an agent run, returns a `run_id`
- `WS /runs/{run_id}` — stream `run.started` / `run.token` / `run.finished` / `run.error` events
- `GET/POST/DELETE /settings` — manage provider API keys
- `GET/DELETE /graph/{project_id}` — read or clear the knowledge graph for a project
- `GET/PUT /graph/node/{node_id}` — inspect or edit a single node and its edges

## License

GPL-3.0. See [`LICENSE`](./LICENSE).
