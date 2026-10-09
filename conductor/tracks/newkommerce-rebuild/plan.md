# Implementation Plan — NewKommerce Rebuild

## Phase 1 — Project skeleton & config
- [ ] `package.json`, `tsconfig`, `vite.config.ts` (proxy + webforge plugin), `index.html`.
- [ ] Tailwind config + `index.css` design tokens.
- [ ] Copy `.webforge/wf-inspector.js` → `public/wf-inspector.js`; install `@babel/*`; wire inspector in `main.tsx`.
- [ ] `npm install`.

## Phase 2 — Backend (FastAPI + SQLite)
- [ ] `backend/seed.py` with all mock data.
- [ ] `backend/main.py`: schema init + seed, Pydantic models, all `/api` routes, CORS `*`.
- [ ] Verify `uvicorn` starts and `curl /api/suppliers` returns data.

## Phase 3 — Frontend foundation
- [ ] `src/types.ts`, `src/lib/api.ts`, `src/lib/format.ts`.
- [ ] UI kit: Button, Badge/StatusBadge, Card, Input, Select, Dialog, Toast, Skeleton, EmptyState, DataTable, Chip/MultiSelect.
- [ ] Layout: `AppLayout`, `Sidebar` (collapsible), topbar; router in `App.tsx`.

## Phase 4 — Pages
- [ ] Dashboard.
- [ ] Suppliers list, Add Supplier wizard, Supplier detail.
- [ ] Products list, Add Product, Product detail.
- [ ] Transactions (+ dialog).
- [ ] Purchase Orders list (+ merge drafts), Raise/Edit PO.

## Phase 5 — Verify & commit
- [ ] `npx tsc --noEmit` clean.
- [ ] Start both servers; curl backend, frontend, proxy.
- [ ] Semantic commits per phase.

## Risks
- Node 20.9 cannot run latest `create-vite` (uses `util.styleText`); scaffold manually.
- Keep SQLite access simple with stdlib `sqlite3`; no ORM.
