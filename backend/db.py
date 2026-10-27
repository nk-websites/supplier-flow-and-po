"""SQLite persistence layer for NewKommerce.

Creates the schema and seeds it with the original mock data on first run.
"""
import json
import os
import sqlite3
import uuid

from seed import (
    ORGANIZATION,
    PRODUCTS,
    PURCHASE_ORDERS,
    PURCHASE_REQUESTS,
    SUPPLIER_PRODUCTS,
    SUPPLIERS,
    TRANSACTIONS,
)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "newkommerce.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    categories TEXT NOT NULL DEFAULT '[]',
    contact_person TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    role TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    state TEXT DEFAULT '',
    country TEXT DEFAULT 'India',
    pincode TEXT DEFAULT '',
    gst TEXT DEFAULT '',
    tax_details TEXT NOT NULL DEFAULT '{}',
    bank_details TEXT NOT NULL DEFAULT '{}',
    payment_terms TEXT DEFAULT 'Net 30',
    contacts TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT DEFAULT '',
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    current REAL NOT NULL DEFAULT 0,
    threshold REAL NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,
    cost_type TEXT NOT NULL DEFAULT 'Last Purchase Price',
    preferred_supplier_id TEXT,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supplier_products (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    product_id TEXT,
    product_name TEXT DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'P1',
    moq REAL NOT NULL DEFAULT 0,
    last_purchased TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    product_id TEXT NOT NULL,
    qty REAL NOT NULL,
    unit TEXT NOT NULL,
    type TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'Outbound',
    store TEXT DEFAULT '',
    destination TEXT NOT NULL DEFAULT '',
    reason TEXT DEFAULT '',
    related_po TEXT DEFAULT '',
    created_by TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    supplier_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    activity_date TEXT NOT NULL,
    tax_rate REAL NOT NULL DEFAULT 0,
    received_date TEXT DEFAULT '',
    received_by TEXT DEFAULT '',
    email_to TEXT DEFAULT '',
    email_subject TEXT DEFAULT '',
    email_body TEXT DEFAULT '',
    email_sent_at TEXT DEFAULT '',
    invoice_name TEXT DEFAULT '',
    invoice_data TEXT DEFAULT '',
    organization_id TEXT DEFAULT '',
    purchasing_entity_id TEXT DEFAULT '',
    mode TEXT DEFAULT 'Centralized',
    requesting_store_id TEXT DEFAULT '',
    submitted_at TEXT DEFAULT '',
    approved_by TEXT DEFAULT '',
    approved_at TEXT DEFAULT '',
    issued_at TEXT DEFAULT '',
    cancelled_reason TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS po_items (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT DEFAULT '',
    qty REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    unit_price REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    received_qty REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS po_line_allocations (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL,
    po_item_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    store_name TEXT DEFAULT '',
    qty REAL NOT NULL DEFAULT 0,
    received_qty REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_requests (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    organization_id TEXT DEFAULT '',
    purchasing_entity_id TEXT DEFAULT '',
    supplier_id TEXT DEFAULT '',
    requesting_store_id TEXT DEFAULT '',
    requesting_store_name TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending Approval',
    requested_by TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    po_id TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_request_items (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT DEFAULT '',
    qty REAL NOT NULL DEFAULT 0,
    unit TEXT DEFAULT 'kg'
);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT DEFAULT '',
    reason TEXT DEFAULT '',
    detail TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def _json(value) -> str:
    return json.dumps(value if value is not None else [])


def _column_names(conn: sqlite3.Connection, table: str) -> set:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def _migrate(conn: sqlite3.Connection) -> None:
    """Add columns introduced after the original schema (safe to re-run)."""
    txn_cols = _column_names(conn, "transactions")
    added_direction = "direction" not in txn_cols
    added_destination = "destination" not in txn_cols

    adds = [
        ("suppliers", "tax_details", "TEXT NOT NULL DEFAULT '{}'"),
        ("suppliers", "bank_details", "TEXT NOT NULL DEFAULT '{}'"),
        ("transactions", "direction", "TEXT NOT NULL DEFAULT 'Outbound'"),
        ("transactions", "destination", "TEXT NOT NULL DEFAULT ''"),
        ("transactions", "store", "TEXT DEFAULT ''"),
        ("po_items", "received_qty", "REAL NOT NULL DEFAULT 0"),
        ("purchase_orders", "received_date", "TEXT DEFAULT ''"),
        ("purchase_orders", "received_by", "TEXT DEFAULT ''"),
        ("purchase_orders", "email_to", "TEXT DEFAULT ''"),
        ("purchase_orders", "email_subject", "TEXT DEFAULT ''"),
        ("purchase_orders", "email_body", "TEXT DEFAULT ''"),
        ("purchase_orders", "email_sent_at", "TEXT DEFAULT ''"),
        ("purchase_orders", "invoice_name", "TEXT DEFAULT ''"),
        ("purchase_orders", "invoice_data", "TEXT DEFAULT ''"),
        ("purchase_orders", "organization_id", "TEXT DEFAULT ''"),
        ("purchase_orders", "purchasing_entity_id", "TEXT DEFAULT ''"),
        ("purchase_orders", "mode", "TEXT DEFAULT 'Centralized'"),
        ("purchase_orders", "requesting_store_id", "TEXT DEFAULT ''"),
        ("purchase_orders", "submitted_at", "TEXT DEFAULT ''"),
        ("purchase_orders", "approved_by", "TEXT DEFAULT ''"),
        ("purchase_orders", "approved_at", "TEXT DEFAULT ''"),
        ("purchase_orders", "issued_at", "TEXT DEFAULT ''"),
        ("purchase_orders", "cancelled_reason", "TEXT DEFAULT ''"),
    ]
    for table, column, decl in adds:
        if column not in _column_names(conn, table):
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")

    # Backfill direction/destination for legacy rows that predate the columns.
    if added_direction or added_destination:
        for row in conn.execute("SELECT id, qty FROM transactions").fetchall():
            direction = "Inbound" if (row["qty"] or 0) >= 0 else "Outbound"
            destination = "Store" if direction == "Inbound" else "Supplier"
            conn.execute(
                "UPDATE transactions SET direction = ?, destination = ? WHERE id = ?",
                (direction, destination, row["id"]),
            )


def init_db() -> None:
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
        _migrate(conn)
        count = conn.execute("SELECT COUNT(*) AS n FROM suppliers").fetchone()["n"]
        if count == 0:
            _seed(conn)
        conn.commit()
    finally:
        conn.close()


def _seed(conn: sqlite3.Connection) -> None:
    for s in SUPPLIERS:
        conn.execute(
            """INSERT INTO suppliers (id, code, name, status, categories, contact_person,
               phone, email, role, address, city, state, country, pincode, gst,
               tax_details, bank_details, payment_terms, contacts)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                s["id"], s["code"], s["name"], s["status"], _json(s["categories"]),
                s.get("contact_person", ""), s.get("phone", ""), s.get("email", ""),
                s.get("role", ""), s.get("address", ""), s.get("city", ""),
                s.get("state", ""), s.get("country", "India"), s.get("pincode", ""),
                s.get("gst", ""), _json(s.get("tax_details", {})),
                _json(s.get("bank_details", {})), s.get("payment_terms", "Net 30"),
                _json(s.get("contacts", [])),
            ),
        )

    for p in PRODUCTS:
        conn.execute(
            """INSERT INTO products (id, code, name, sku, category, unit, current,
               threshold, cost, cost_type, preferred_supplier_id, notes)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                p["id"], p["code"], p["name"], p.get("sku", ""), p["category"],
                p["unit"], p["current"], p["threshold"], p["cost"], p["cost_type"],
                p.get("preferred_supplier_id"), p.get("notes", ""),
            ),
        )

    prod_names = {p["id"]: p["name"] for p in PRODUCTS}
    for sp in SUPPLIER_PRODUCTS:
        conn.execute(
            """INSERT INTO supplier_products (id, supplier_id, product_id, product_name, price,
               unit, priority, moq, last_purchased) VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                new_id("sp-"), sp["supplier_id"], sp["product_id"],
                prod_names.get(sp["product_id"], ""), sp["price"],
                sp["unit"], sp["priority"], sp["moq"], sp.get("last_purchased", ""),
            ),
        )

    for t in TRANSACTIONS:
        conn.execute(
            """INSERT INTO transactions (id, date, product_id, qty, unit, type, direction,
               store, destination, reason, related_po, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                new_id("txn-"), t["date"], t["product_id"], t["qty"], t["unit"],
                t["type"], t.get("direction", "Outbound"), t.get("store", ""),
                t.get("destination", ""), t.get("reason", ""), t.get("related_po", ""),
                t.get("created_by", ""),
            ),
        )

    prod_names = {p["id"]: p["name"] for p in PRODUCTS}
    for po in PURCHASE_ORDERS:
        po_id = new_id("po-")
        conn.execute(
            """INSERT INTO purchase_orders (id, reference, supplier_id, status, activity_date)
               VALUES (?,?,?,?,?)""",
            (po_id, po["reference"], po["supplier_id"], po["status"], po["activity_date"]),
        )
        for it in po["items"]:
            line_total = round(it["qty"] * it["unit_price"], 2)
            conn.execute(
                """INSERT INTO po_items (id, po_id, product_id, product_name, qty, unit,
                   unit_price, line_total) VALUES (?,?,?,?,?,?,?,?)""",
                (
                    new_id("poi-"), po_id, it["product_id"],
                    prod_names.get(it["product_id"], ""), it["qty"], it["unit"],
                    it["unit_price"], line_total,
                ),
            )

    for pr in PURCHASE_REQUESTS:
        pr_id = new_id("pr-")
        conn.execute(
            """INSERT INTO purchase_requests (id, reference, organization_id, purchasing_entity_id,
               supplier_id, requesting_store_id, requesting_store_name, status, requested_by, notes)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                pr_id, pr["reference"], ORGANIZATION["id"], pr.get("purchasing_entity_id", ""),
                pr.get("supplier_id", ""), pr.get("requesting_store_id", ""),
                pr.get("requesting_store_name", ""), pr.get("status", "Pending Approval"),
                pr.get("requested_by", ""), pr.get("notes", ""),
            ),
        )
        for it in pr["items"]:
            conn.execute(
                """INSERT INTO purchase_request_items (id, request_id, product_id, product_name, qty, unit)
                   VALUES (?,?,?,?,?,?)""",
                (
                    new_id("pri-"), pr_id, it["product_id"],
                    prod_names.get(it["product_id"], ""), it["qty"], it.get("unit", "kg"),
                ),
            )
