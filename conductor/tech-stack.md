# Tech Stack

## Frontend

- **Vite + React 18 + TypeScript** (strict), `react-router-dom`.
- **Tailwind CSS v3** with CSS-variable design tokens (`hsl(var(--...))`).
- **Inter** typeface via `@fontsource-variable/inter`.
- **lucide-react** icons.
- Dev server on **0.0.0.0:14775**:
  `npm run dev -- --host 0.0.0.0 --port 14775`.
- All API calls go through the Vite proxy: `server.proxy["/api"] =
  "http://localhost:14776"`. The browser only ever calls `/api/...`.

## Backend

- **FastAPI** (Python 3.11) with **Pydantic** models.
- **SQLite** (stdlib `sqlite3`) persisted at `backend/newkommerce.db`,
  seeded on first run with the original mock data.
- Served with uvicorn on **0.0.0.0:14776**:
  `uvicorn main:app --host 0.0.0.0 --port 14776`.
- Permissive CORS (`allow_origins=["*"]`) for dev.

## Ports

Per this project's reserved block in `AGENTS.md`:

| Service | Port |
| --- | --- |
| Frontend / preview | 14775 |
| Backend / API | 14776 |
| Spares | 14777, 14778, 14779 |

## Conventions

- npm; small, working increments; live preview always available.
- Click-to-select visual editing wired via `.webforge/` (see `AGENTS.md`).
- No second styling or state library; server state is fetched through a thin
  typed `lib/api.ts` client (no Redux needed for this app's scope).
