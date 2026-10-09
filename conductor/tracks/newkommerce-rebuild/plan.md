# Implementation Plan — NewKommerce Rebuild

## Phase 1 — Project skeleton & config
- [x] `package.json`, `tsconfig`, `vite.config.ts` (proxy + webforge plugin), `index.html`.
- [x] Tailwind config + `index.css` design tokens.
- [x] Copy `.webforge/wf-inspector.js` → `public/wf-inspector.js`; install `@babel/*`; wire inspector in `main.tsx`.
- [x] `npm install`.

## Phase 2 — Backend (FastAPI + SQLite)
- [x] `backend/seed.py` with all mock data.
- [x] `backend/main.py`: schema init + seed, Pydantic models, all `/api` routes, CORS `*`.
- [x] Verify `uvicorn` starts and `curl /api/suppliers` returns data.

## Phase 3 — Frontend foundation
- [x] `src/types.ts`, `src/lib/api.ts`, `src/lib/format.ts`.
- [x] UI kit: Button, Badge/StatusBadge, Card, Input, Select, Dialog, Toast, Skeleton, EmptyState, DataTable, Chip/MultiSelect.
- [x] Layout: `AppLayout`, `Sidebar` (collapsible), topbar; router in `App.tsx`.

## Phase 4 — Pages
- [x] Dashboard.
- [x] Suppliers list, Add Supplier wizard, Supplier detail.
- [x] Products list, Add Product, Product detail.
- [x] Transactions (+ dialog).
- [x] Purchase Orders list (+ merge drafts), Raise/Edit PO.

## Phase 5 — Verify & commit
- [x] `npx tsc --noEmit` clean.
- [x] Start both servers; curl backend, frontend, proxy.
- [x] Semantic commits per phase.

## Risks
- Node 20.9 cannot run latest `create-vite` (uses `util.styleText`); scaffold manually.
- Keep SQLite access simple with stdlib `sqlite3`; no ORM.
