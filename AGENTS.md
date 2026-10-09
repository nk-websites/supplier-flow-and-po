<!-- appforge-ports -->
# Project

This project has a reserved port block (stable across restarts — the preview
pane and any preview URL the user shares point here):

- **Frontend / preview: `14775`** — run the frontend dev server on this
  port; it is what the Preview pane opens first.
- **Main backend / API: `14776`** (for full-stack projects)
- **Spare ports: `14777`, `14778`, `14779`** — additional services (workers, websocket
  servers, second API, etc.) in this order.

Rules:

- ALWAYS bind every server to 0.0.0.0 (not localhost) so the public preview
  can reach it.
- Frontend: `npm run dev -- --host 0.0.0.0 --port 14775`
  (Next.js: `npm run dev -- -p 14775`).
- Backend/API on `14776`: e.g. `uvicorn main:app --host 0.0.0.0 --port 14776`,
  `PORT=14776 node server.js`, `flask run --host 0.0.0.0 --port 14776`.
- **Frontend → backend calls MUST go through the frontend dev server's
  proxy**, so the browser only ever talks to the frontend origin (no CORS,
  works through the shared preview URL):
  - Vite — in `vite.config.ts`:
    `server: { proxy: { "/api": "http://localhost:14776" } }`, then call
    `fetch("/api/...")` from the frontend (never `localhost:14776` directly).
  - Next.js — `rewrites()` in `next.config.js`:
    `{ source: "/api/:path*", destination: "http://localhost:14776/:path*" }`.
  - If the backend does not live under an `/api` prefix, pick one and proxy it.
- If an assigned port is already taken, do NOT kill the process holding it —
  that belongs to another project, and its owner may have shared that URL
  with someone. Move that server to the next free port instead (`ss -ltn`
  shows what's taken); use the spare ports first.
- NEVER kill, restart, or rebind processes belonging to another project
  folder under /home/user/workspaces.

  **IMPORANT**: In vite as well as fastapi CORS config, remeber that this is a dev app,
  so, you should apply * as CORS to it, so that it never breaks.
