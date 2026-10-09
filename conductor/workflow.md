# Workflow

## Lifecycle

Context → Spec & Plan → Implement. No feature code lands before its spec and
plan exist under `conductor/tracks/<track>/`.

## Development Rules

1. Keep changes small and working; the user watches a live preview.
2. Frontend → backend calls go through the `/api` Vite proxy only. Never
   call `localhost:14776` from the browser.
3. Bind all servers to `0.0.0.0`. Use the reserved ports; if one is taken,
   move to the next spare and report it. Never kill another project's process.
4. TypeScript strict; avoid `any`; no unused imports.
5. Prefer native semantic elements; keep UI accessible (labels, focus-visible,
   keyboard).

## Quality Gates

- `npx tsc --noEmit` passes with no errors.
- Vite dev server logs no errors.
- `curl` checks:
  - `curl -s localhost:14776/api/suppliers` returns seeded suppliers.
  - `curl -s localhost:14775/` returns the app shell.
  - `curl -s localhost:14775/api/products` proves the proxy works.

## Commits

Semantic commits, e.g. `feat(backend): ...`, `feat(frontend): ...`,
`chore: ...`. Commit only intended files.

## Revert

Each plan phase is independently revertable; commits are grouped per phase.
