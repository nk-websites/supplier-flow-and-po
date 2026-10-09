# Conductor — Project Index

Source of truth for the **NewKommerce** rebuild.

## Project Context

- [Product Definition](./product.md) — what we are building and why.
- [Tech Stack](./tech-stack.md) — languages, frameworks, ports, conventions.
- [Workflow](./workflow.md) — development and quality rules.
- [Tracks Registry](./tracks.md) — all tracks.

## What is NewKommerce?

A supplier & raw-material management admin back office for a
food-delivery / cloud-kitchen business. It is a full-stack rebuild of the
original Lovable SPA (`https://crimson-kitchen-hub.lovable.app`) with a
refreshed, more polished design and a real persistent backend.

- **Frontend**: Vite + React + TypeScript + Tailwind, dark sidebar + light
  content area, crimson brand accent, Inter typeface.
- **Backend**: FastAPI (Python 3.11) + SQLite, seeded with the original mock
  data, exposed under `/api`.

## Quick Start

```bash
# Backend (port 14776)
cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 14776

# Frontend (port 14775)
npm run dev -- --host 0.0.0.0 --port 14775
```

Open the preview on `14775`. Frontend talks to the API only through the Vite
proxy (`/api` → `http://localhost:14776`).

## Active Tracks

| Track | Status | Spec | Plan |
| --- | --- | --- | --- |
| [newkommerce-rebuild](./tracks/newkommerce-rebuild/index.md) | In Progress | [spec](./tracks/newkommerce-rebuild/spec.md) | [plan](./tracks/newkommerce-rebuild/plan.md) |
