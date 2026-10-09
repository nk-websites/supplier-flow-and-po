# Specification — NewKommerce Rebuild

## 1. Goal

A working, full-stack recreation of the NewKommerce admin app with the same
information architecture and data as the original, a refreshed/improved
visual design, and a persistent backend whose CRUD survives restarts.

## 2. Scope

### In scope

- Full route set (dashboard, suppliers, products, transactions, POs) matching
  the original IA.
- FastAPI backend exposing REST CRUD under `/api` with SQLite persistence,
  seeded with the provided mock data.
- Vite + React + TS + Tailwind frontend, dark sidebar + light content,
  crimson accent, Inter.
- Click-to-select visual editing wiring per `AGENTS.md`.
- Both servers running and verified.

### Out of scope (this pass)

- Auth/users/roles.
- Real email sending ("Send to Supplier" only changes PO status).
- File uploads, reporting exports, multi-currency.

## 3. Routes (frontend)

| Route | Screen |
| --- | --- |
| `/` | Dashboard (KPIs, recent transactions, POs needing attention, quick actions) |
| `/suppliers` | Supplier list (stat chips, category filter, table) |
| `/suppliers/new` | Add Supplier 2-step wizard |
| `/suppliers/:id` | Supplier detail (products supplied, POs, vendor rail) |
| `/inventory/products` | Products list (alert banner, stat chips, filters, table) |
| `/inventory/raw-materials/new` | Add Product form |
| `/inventory/raw-materials/:id` | Product detail (stock, cost history, transactions, suggested purchase) |
| `/inventory/transactions` | Inventory transactions + new-transaction dialog |
| `/purchase-orders` | PO list (status tabs w/ counts, supplier filter, merge drafts) |
| `/purchase-orders/new` (+ `?draft=<id>`) | Raise/edit PO |

## 4. API (backend, all under `/api`)

- `GET/POST /api/suppliers`; `GET/PUT/DELETE /api/suppliers/{id}`
- `GET /api/suppliers/{id}/products`; `GET /api/suppliers/{id}/purchase-orders`
- `GET/POST /api/products`; `GET/PUT/DELETE /api/products/{id}`
- `GET /api/products/suggested-purchases`
- `GET/POST /api/transactions` (POST records movement & updates stock)
- `GET/POST /api/purchase-orders`; `GET/PUT/DELETE /api/purchase-orders/{id}`
- `POST /api/purchase-orders/{id}/send`
- `POST /api/purchase-orders/merge-drafts`
- `GET /api/dashboard`

Validation via Pydantic; sensible `404` / `400` responses.

## 5. Data model

- **Supplier**: code, name, categories[], status, address/city/state/country/
  pincode, gst, contacts[{name, phone, email, role, primary}], payment_terms.
- **Product**: code, name, sku, category, unit, current, threshold, cost,
  cost_type, preferred_supplier_id, notes; derived status.
- **SupplierProduct**: supplier_id, product_id, price, unit, priority, moq,
  last_purchased.
- **Transaction**: date, product_id, qty (signed), type, reason, related_po,
  created_by.
- **PurchaseOrder**: reference, supplier_id, status, activity_date, items[];
  + **POItem**: product_id/name, qty, unit, unit_price, line_total.

Seed data exactly as specified (suppliers, products, transactions, POs
Draft 7 / Sent 3 / Completed 0 / Cancelled 1, supplier prices).

## 6. Design

- Crimson primary token; success/warn/danger/info status colors; ~10px radius.
- 8px spacing rhythm; Inter; crisp borders; subtle elevation.
- Consistent DataTable, badges, buttons, inputs, dialogs, toasts, skeletons,
  empty states, focus-visible rings, responsive collapsible sidebar.

## 7. Acceptance Criteria

1. All routes render and are reachable via the sidebar.
2. Backend CRUD persists across restarts (SQLite).
3. Proxy works: browser uses only same-origin `/api`.
4. `npx tsc --noEmit` clean; Vite logs no errors.
5. `curl` verification of backend, frontend, and proxy succeeds.
