---
target: src (NewKommerce rebuild)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/home/user/workspaces/3e2fb05bbdb9/src (NewKommerce rebuild)"
timestamp: 2026-10-09T07-04-18Z
slug: src-newkommerce-rebuild
---
# Critique — NewKommerce rebuild (`src`)

Method: dual-agent (A: design-review subagent · B: detector subagent; browser overlays skipped — no headless browser available)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good skeletons/badges/toasts; the "Live" pill and static breadcrumb assert state that is fake. |
| 2 | Match System / Real World | 3 | Strong domain nouns (MOQ, cost_type, "Raise PO"); "Per Unit" column actually holds the unit, not a value. |
| 3 | User Control and Freedom | 2 | Dialogs escape well, but "Send to Supplier" and "Merge Drafts" are irreversible with no confirm/undo; unsaved forms lose data on nav. |
| 4 | Consistency and Standards | 3 | Components consistent; filters are pills on 3 pages but a select on Transactions; PO list has no search; "View" vs "Edit draft". |
| 5 | Error Prevention | 2 | Validation exists, but stock is editable directly (bypasses ledger), no duplicate-name guard, no destructive confirms. |
| 6 | Recognition Rather Than Recall | 2 | Native `<select>` product pickers with no search/SKU/on-hand; free-text "Related PO". |
| 7 | Flexibility and Efficiency | 2 | No sort, pagination, bulk, saved views, or keyboard shortcuts anywhere. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean and restrained; slightly low density for Operate; 5-across stat row crowds small screens. |
| 9 | Error Recovery | 3 | ErrorState+retry and surfaced API detail good; PO errors land as one string in the footer, not on the field. |
| 10 | Help and Documentation | 1 | Almost none: P0/P1/P2, MOQ, cost types never explained; no glossary or onboarding. |
| **Total** | | **24/40** | **Acceptable (significant improvements needed)** |

## Design Specificity Verdict

**LLM assessment (A):** Partially authored — domain-aware in *data*, category-interchangeable in *form*. The content is genuinely food-procurement (INR/en-IN formatting, GST/Tax ID, Net 7/15/30/COD, P0/P1/P2 vendor priority, "Spoilage" reasons) and the crimson primary keeps the NewKommerce brand. But the shell is generic SaaS admin — dark-slate sidebar, Inter, rounded cards, pill filters, 5 stat cards — the same grammar as any HR/logistics/PM back office. Nothing in the form evokes ingredients, stock, or true per-unit cost even though `cost_type` exists in the model.

**Deterministic scan (B):** 0 findings across `src`, its subdirs, individual entries, and `index.html` (exit 0, clean; a synthetic control file was caught, proving the detector works). No false positives. The clean result is not due to ignore/config suppression. Browser overlays were skipped — no chromium/playwright/puppeteer present.

**Synthesis:** The detector confirms the code is free of the mechanical ai-slop rules it checks (color palettes, generic patterns), so the remaining gap is product character, not compliance. The rebuild is materially stronger than the original on resilience, a11y primitives, and IA (grouped sidebar, count badges, skeletons, empty/error states, toasts, PO tax breakdown, mobile drawer). The original was better in places the rebuild dropped: editable "Map Product" catalog linking on supplier detail, a correctly-reading combined "Price Per Unit", explicit per-row Edit on the supplier list, visible version/footer metadata, and supplier-detail copy that named the domain value ("true per-unit cost").

## Overall Impression

A competent, well-engineered admin shell with genuine domain data and strong state handling, wrapped in a look that could belong to any back office. The single biggest opportunity is to let the food-procurement model drive the interface — surface true cost, make the work surface (tables) carry the brand, and put real safety on the money-committing action.

## What's Working

1. **Real resilience language:** every list wires loading → ErrorState+retry → EmptyState → data with copy distinguishing "none yet" vs "none match filters" (`src/pages/SuppliersPage.tsx:86-108`).
2. **Audited component system:** semantic status tone maps (`src/components/ui/Badge.tsx:37-81`), `:focus-visible` ring and `prefers-reduced-motion` (`src/index.css:54,58`), `aria-live="polite"` toasts (`src/components/ui/Toast.tsx:58`), `aria-pressed` on toggles (`src/components/ui/Chip.tsx:65`).
3. **Domain model surfaced intelligently:** PO summary computes tax line-by-line (`src/pages/PurchaseOrderNewPage.tsx:98-103`); supplier "At a glance" derives P0 count / open POs / lifetime spend (`src/pages/SupplierDetailPage.tsx:53-57`).

## Priority Issues

- **[P0] PO "Send to Supplier" is an unguarded, irreversible commit with a dead-end disabled state.** `src/pages/PurchaseOrderNewPage.tsx:408-415`. One misclick commits money to a vendor with no confirm and no undo; reopening a non-draft shows a disabled primary with no explanation. Fix: confirmation step showing supplier, recipient, item count, total; replace disabled button with an explanatory banner. Command: `/impeccable harden`.
- **[P1] Product stock is editable directly, bypassing the transaction ledger.** `src/pages/ProductDetailPage.tsx:369-371`. Silent stock rewrites corrupt the audit trail the Transactions page exists to provide. Fix: make stock read-only in the product editor; route changes through `NewTransactionDialog`. Command: `/impeccable harden`.
- **[P1] Surrogate product pickers + silent option-source switch.** `src/pages/PurchaseOrderNewPage.tsx:80-96,312`; `src/pages/TransactionsPage.tsx:206`. Native selects with no search/SKU/on-hand force recall and break at scale; when a supplier has no linked products the PO quietly lists the entire catalog. Fix: searchable combobox (name + SKU + on-hand + unit); surface the fallback explicitly. Command: `/impeccable optimize`.
- **[P1] Fake global chrome: static breadcrumb + meaningless "Live" indicator.** `src/components/layout/AppLayout.tsx:59-68`. A "Live" pulse that reflects nothing and a breadcrumb that never changes mislead users about location and realtime state. Fix: derive the crumb from `useLocation`; wire "Live" to a real poll or remove it. Command: `/impeccable clarify`.
- **[P2] No power-user affordances.** Lists lack sorting, pagination, bulk actions, search on PO/Transactions, saved filters, shortcuts. Fix: column sort + pagination + a command palette / `g`-navigation. Command: `/impeccable optimize`.
- **[P3] Unexplained domain vocabulary.** `src/components/ui/Badge.tsx:56`, `src/pages/TransactionsPage.tsx:275`. P0/P1/P2, MOQ, cost types, "Related PO" are never explained. Fix: inline tooltips/glossary + first-run hint. Command: `/impeccable document`.

## Persona Red Flags

- **Alex (power user):** no sort/pagination/bulk edit/column choice; unfiltered native-select pickers; `src/pages/ProductsPage.tsx:160` is View-only; SupplierProduct.product_id exists but the UI never exposes product mapping. Merge Drafts is the only bulk tool.
- **Sam (keyboard/a11y):** `src/components/ui/Dialog.tsx:23-34` has no focus trap, no initial focus, no focus return; `aria-label` only set when title is a string; `SearchInput` is placeholder-only, no label (`src/components/ui/Misc.tsx:130`); `<th>` have no `scope`; mobile drawer isn't inert. Good: icon-button labels, `aria-pressed`, reduced-motion.
- **Jordan (first-timer):** no onboarding; must infer supplier is chosen before items appear; disabled Send unexplained; "Merge Drafts", "cost basis", "MOQ" undefined; "Created By" hardcoded to a name that isn't theirs (`src/pages/TransactionsPage.tsx:146`).

## Minor Observations

- Dark-mode is configured (`tailwind.config.js:3`) but no `.dark` tokens exist — dead config.
- Price-history dialog admits it holds only one data point — a placeholder presented as a feature.
- Module-level `seq` counters in `SupplierNewPage`/`PurchaseOrderNewPage` are collision-prone if co-mounted.
- No `AbortController` in `useAsync` — in-flight loads can resolve after unmount across route changes.
- New-PO title uses `reference`, empty for an unsaved draft → "Purchase Order " with a trailing gap (`src/pages/PurchaseOrderNewPage.tsx:226`).

## Questions to Consider

- The "Live" badge — *what* is live? If nothing, why assert it?
- Operate mode says task completion outranks expression — so why is the sidebar a dark branded slab while the working surface (tables) is the plainest thing on screen?
- Sending a PO commits money and is one unprotected click, yet closing a harmless dialog has three escape hatches. Is the safety budget inverted?
- At 500 products every picker is a native `<select>` with no search/pagination — what is the plan?
- The original let you map a supplier's quoted item to a catalog product; the model still allows it, but the rebuild never exposes it. Dropped or deferred?
