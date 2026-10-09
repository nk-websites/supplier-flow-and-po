"""SQLite persistence layer for NewKommerce.

Creates the schema and seeds it with the original mock data on first run.
"""
import json
import os
import sqlite3
import uuid

from seed import (
    PRODUCTS,
    PURCHASE_ORDERS,
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
    line_total REAL NOT NULL DEFAULT 0
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


def init_db() -> None:
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
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
               payment_terms, contacts)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                s["id"], s["code"], s["name"], s["status"], _json(s["categories"]),
                s.get("contact_person", ""), s.get("phone", ""), s.get("email", ""),
                s.get("role", ""), s.get("address", ""), s.get("city", ""),
                s.get("state", ""), s.get("country", "India"), s.get("pincode", ""),
                s.get("gst", ""), s.get("payment_terms", "Net 30"), _json(s.get("contacts", [])),
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
            """INSERT INTO transactions (id, date, product_id, qty, unit, type, reason,
               related_po, created_by) VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                new_id("txn-"), t["date"], t["product_id"], t["qty"], t["unit"],
                t["type"], t.get("reason", ""), t.get("related_po", ""), t.get("created_by", ""),
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
