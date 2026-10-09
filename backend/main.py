"""NewKommerce API — FastAPI + SQLite.

Run: uvicorn main:app --host 0.0.0.0 --port 14776
"""
import json
import sqlite3
from datetime import date
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import db
import seed as seed_data

app = FastAPI(title="NewKommerce API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


# ----------------------------------------------------------------------------
# Pydantic models
# ----------------------------------------------------------------------------
class ContactIn(BaseModel):
    name: str = ""
    phone: str = ""
    email: str = ""
    role: str = ""
    primary: bool = False


class SupplierProductIn(BaseModel):
    product_id: Optional[str] = None
    name: str = ""
    price: float = 0
    unit: str = "kg"
    priority: str = "P1"
    moq: float = 0


class SupplierIn(BaseModel):
    name: str = Field(min_length=1)
    code: str = ""
    categories: List[str] = []
    status: str = "Active"
    contact_person: str = ""
    phone: str = ""
    email: str = ""
    role: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    country: str = "India"
    pincode: str = ""
    gst: str = ""
    payment_terms: str = "Net 30"
    contacts: List[ContactIn] = []
    products: List[SupplierProductIn] = []


class ProductIn(BaseModel):
    name: str = Field(min_length=1)
    code: str = ""
    sku: str = ""
    category: str
    unit: str
    current: float = 0
    threshold: float = 0
    cost: float = 0
    cost_type: str = "Last Purchase Price"
    preferred_supplier_id: Optional[str] = None
    notes: str = ""


class TransactionIn(BaseModel):
    product_id: str
    qty: float
    type: str
    reason: str = ""
    related_po: str = ""
    created_by: str = ""
    date: Optional[str] = None


class POItemIn(BaseModel):
    product_id: str
    qty: float = 0
    unit: str = "kg"
    unit_price: float = 0


class POIn(BaseModel):
    supplier_id: str
    status: str = "Draft"
    activity_date: Optional[str] = None
    tax_rate: float = 0
    items: List[POItemIn] = []


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def _loads(value: Optional[str]):
    if not value:
        return []
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []


def product_status(current: float, threshold: float) -> str:
    if current <= 0:
        return "Out Of Stock"
    if current <= threshold:
        return "Low Stock"
    return "In Stock"


def _supplier(row: sqlite3.Row, conn: sqlite3.Connection) -> dict:
    d = dict(row)
    d["categories"] = _loads(d.get("categories"))
    d["contacts"] = _loads(d.get("contacts"))
    count = conn.execute(
        "SELECT COUNT(*) AS n FROM supplier_products WHERE supplier_id = ?", (row["id"],)
    ).fetchone()["n"]
    d["items_count"] = count
    return d


def _product(row: sqlite3.Row, conn: sqlite3.Connection) -> dict:
    d = dict(row)
    d["status"] = product_status(d["current"], d["threshold"])
    if d.get("preferred_supplier_id"):
        sup = conn.execute(
            "SELECT name FROM suppliers WHERE id = ?", (d["preferred_supplier_id"],)
        ).fetchone()
        d["preferred_supplier_name"] = sup["name"] if sup else ""
    else:
        d["preferred_supplier_name"] = ""
    return d


def _transaction(row: sqlite3.Row, conn: sqlite3.Connection) -> dict:
    d = dict(row)
    prod = conn.execute(
        "SELECT name, sku FROM products WHERE id = ?", (d["product_id"],)
    ).fetchone()
    d["product_name"] = prod["name"] if prod else ""
    d["product_sku"] = prod["sku"] if prod else ""
    return d


def _po(po_id: str, conn: sqlite3.Connection) -> Optional[dict]:
    row = conn.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    sup = conn.execute("SELECT name FROM suppliers WHERE id = ?", (row["supplier_id"],)).fetchone()
    d["supplier_name"] = sup["name"] if sup else ""
    items = conn.execute(
        "SELECT * FROM po_items WHERE po_id = ? ORDER BY rowid", (po_id,)
    ).fetchall()
    d["items"] = [dict(i) for i in items]
    subtotal = round(sum(i["line_total"] for i in items), 2)
    tax = round(subtotal * (d.get("tax_rate") or 0) / 100, 2)
    d["subtotal"] = subtotal
    d["tax"] = tax
    d["total"] = round(subtotal + tax, 2)
    d["item_count"] = len(items)
    return d


def _next_reference(conn: sqlite3.Connection, prefix: str) -> str:
    if prefix == "DRAFT":
        rows = conn.execute(
            "SELECT reference FROM purchase_orders WHERE reference LIKE 'DRAFT-%'"
        ).fetchall()
        nums = [int(r["reference"].split("-")[1]) for r in rows if r["reference"].split("-")[1].isdigit()]
        n = (max(nums) + 1) if nums else 1
        return f"DRAFT-{n:03d}"
    year = date.today().year
    like = f"PO-{year}-%"
    rows = conn.execute(
        "SELECT reference FROM purchase_orders WHERE reference LIKE ?", (like,)
    ).fetchall()
    nums = [int(r["reference"].split("-")[2]) for r in rows if r["reference"].split("-")[2].isdigit()]
    n = (max(nums) + 1) if nums else 1
    return f"PO-{year}-{n:03d}"


# ----------------------------------------------------------------------------
# Meta
# ----------------------------------------------------------------------------
@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/meta")
def meta() -> dict:
    return {
        "categories": seed_data.CATEGORIES,
        "countries": seed_data.COUNTRIES,
        "payment_terms": seed_data.PAYMENT_TERMS,
        "priorities": seed_data.PRIORITIES,
        "transaction_types": seed_data.TRANSACTION_TYPES,
        "units": ["kg", "litre", "piece", "dozen", "pack", "gram"],
        "order_statuses": ["Draft", "Sent", "Completed", "Cancelled"],
        "supplier_statuses": ["Active", "Inactive", "Pending Verification"],
    }


# ----------------------------------------------------------------------------
# Dashboard
# ----------------------------------------------------------------------------
@app.get("/api/dashboard")
def dashboard() -> dict:
    conn = db.get_conn()
    try:
        total_suppliers = conn.execute("SELECT COUNT(*) n FROM suppliers").fetchone()["n"]
        prods = conn.execute("SELECT * FROM products").fetchall()
        low = 0
        out = 0
        for p in prods:
            st = product_status(p["current"], p["threshold"])
            if st == "Low Stock":
                low += 1
            elif st == "Out Of Stock":
                out += 1
        open_pos = conn.execute(
            "SELECT COUNT(*) n FROM purchase_orders WHERE status IN ('Draft','Sent')"
        ).fetchone()["n"]
        pos = conn.execute("SELECT * FROM purchase_orders").fetchall()
        lifetime_spend = 0.0
        for po in pos:
            if po["status"] in ("Sent", "Completed"):
                full = _po(po["id"], conn)
                if full:
                    lifetime_spend += full["total"]
        lifetime_spend = round(lifetime_spend, 2)

        recent = conn.execute(
            "SELECT * FROM transactions ORDER BY date DESC, created_at DESC LIMIT 6"
        ).fetchall()
        attention = conn.execute(
            "SELECT * FROM purchase_orders WHERE status = 'Draft' ORDER BY activity_date DESC, updated_at DESC"
        ).fetchall()

        return {
            "kpis": {
                "total_suppliers": total_suppliers,
                "low_stock": low,
                "out_of_stock": out,
                "open_purchase_orders": open_pos,
                "lifetime_spend": lifetime_spend,
            },
            "recent_transactions": [_transaction(r, conn) for r in recent],
            "purchase_orders_needing_attention": [_po(r["id"], conn) for r in attention],
        }
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Suppliers
# ----------------------------------------------------------------------------
@app.get("/api/suppliers")
def list_suppliers(
    status: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
) -> List[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute("SELECT * FROM suppliers ORDER BY code").fetchall()
        out = [_supplier(r, conn) for r in rows]
        if status and status != "All":
            out = [s for s in out if s["status"] == status]
        if category and category != "All":
            out = [s for s in out if category in s["categories"]]
        if q:
            ql = q.lower()
            out = [s for s in out if ql in s["name"].lower() or ql in (s["contact_person"] or "").lower()]
        return out
    finally:
        conn.close()


@app.post("/api/suppliers", status_code=201)
def create_supplier(payload: SupplierIn) -> dict:
    conn = db.get_conn()
    try:
        code = payload.code.strip()
        if not code:
            n = conn.execute("SELECT COUNT(*) n FROM suppliers").fetchone()["n"]
            code = f"SUP-{n + 1:03d}"
        sid = db.new_id("sup-")
        contacts = [c.model_dump() for c in payload.contacts]
        primary = next((c for c in contacts if c.get("primary")), contacts[0] if contacts else None)
        contact_person = payload.contact_person or (primary["name"] if primary else "")
        phone = payload.phone or (primary.get("phone", "") if primary else "")
        email = payload.email or (primary.get("email", "") if primary else "")
        conn.execute(
            """INSERT INTO suppliers (id, code, name, status, categories, contact_person,
               phone, email, role, address, city, state, country, pincode, gst, payment_terms, contacts)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                sid, code, payload.name, payload.status, json.dumps(payload.categories),
                contact_person, phone, email, payload.role, payload.address, payload.city,
                payload.state, payload.country, payload.pincode, payload.gst,
                payload.payment_terms, json.dumps(contacts),
            ),
        )
        prod_names = {p["id"]: p["name"] for p in conn.execute("SELECT id, name FROM products").fetchall()}
        for sp in payload.products:
            name = sp.name or prod_names.get(sp.product_id or "", "")
            conn.execute(
                """INSERT INTO supplier_products (id, supplier_id, product_id, product_name,
                   price, unit, priority, moq) VALUES (?,?,?,?,?,?,?,?)""",
                (db.new_id("sp-"), sid, sp.product_id, name, sp.price, sp.unit, sp.priority, sp.moq),
            )
        conn.commit()
        row = conn.execute("SELECT * FROM suppliers WHERE id = ?", (sid,)).fetchone()
        return _supplier(row, conn)
    finally:
        conn.close()


@app.get("/api/suppliers/{supplier_id}")
def get_supplier(supplier_id: str) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM suppliers WHERE id = ?", (supplier_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Supplier not found")
        return _supplier(row, conn)
    finally:
        conn.close()


@app.put("/api/suppliers/{supplier_id}")
def update_supplier(supplier_id: str, payload: SupplierIn) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM suppliers WHERE id = ?", (supplier_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Supplier not found")
        contacts = [c.model_dump() for c in payload.contacts]
        conn.execute(
            """UPDATE suppliers SET name=?, categories=?, status=?, contact_person=?, phone=?,
               email=?, role=?, address=?, city=?, state=?, country=?, pincode=?, gst=?,
               payment_terms=?, contacts=? WHERE id=?""",
            (
                payload.name, json.dumps(payload.categories), payload.status,
                payload.contact_person, payload.phone, payload.email, payload.role,
                payload.address, payload.city, payload.state, payload.country,
                payload.pincode, payload.gst, payload.payment_terms,
                json.dumps(contacts), supplier_id,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM suppliers WHERE id = ?", (supplier_id,)).fetchone()
        return _supplier(row, conn)
    finally:
        conn.close()


@app.delete("/api/suppliers/{supplier_id}", status_code=204)
def delete_supplier(supplier_id: str) -> None:
    conn = db.get_conn()
    try:
        conn.execute("DELETE FROM suppliers WHERE id = ?", (supplier_id,))
        conn.execute("DELETE FROM supplier_products WHERE supplier_id = ?", (supplier_id,))
        conn.commit()
    finally:
        conn.close()


@app.get("/api/suppliers/{supplier_id}/products")
def supplier_products(supplier_id: str) -> List[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM supplier_products WHERE supplier_id = ? ORDER BY priority, product_name",
            (supplier_id,),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            if not d["product_name"] and d["product_id"]:
                prod = conn.execute(
                    "SELECT name FROM products WHERE id = ?", (d["product_id"],)
                ).fetchone()
                d["product_name"] = prod["name"] if prod else ""
            out.append(d)
        return out
    finally:
        conn.close()


@app.get("/api/suppliers/{supplier_id}/purchase-orders")
def supplier_pos(supplier_id: str) -> List[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT id FROM purchase_orders WHERE supplier_id = ? ORDER BY activity_date DESC",
            (supplier_id,),
        ).fetchall()
        return [_po(r["id"], conn) for r in rows]
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Products
# ----------------------------------------------------------------------------
@app.get("/api/products")
def list_products(
    category: Optional[str] = None,
    unit: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
) -> List[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute("SELECT * FROM products ORDER BY code").fetchall()
        out = [_product(r, conn) for r in rows]
        if category and category != "All":
            out = [p for p in out if p["category"] == category]
        if unit and unit != "All":
            out = [p for p in out if p["unit"] == unit]
        if status and status not in ("All",):
            out = [p for p in out if p["status"] == status]
        if q:
            ql = q.lower()
            out = [p for p in out if ql in p["name"].lower() or ql in (p["sku"] or "").lower()]
        return out
    finally:
        conn.close()


@app.post("/api/products", status_code=201)
def create_product(payload: ProductIn) -> dict:
    conn = db.get_conn()
    try:
        code = payload.code.strip()
        if not code:
            n = conn.execute("SELECT COUNT(*) n FROM products").fetchone()["n"]
            code = f"RM-{n + 1:03d}"
        pid = db.new_id("prod-")
        conn.execute(
            """INSERT INTO products (id, code, name, sku, category, unit, current, threshold,
               cost, cost_type, preferred_supplier_id, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                pid, code, payload.name, payload.sku, payload.category, payload.unit,
                payload.current, payload.threshold, payload.cost, payload.cost_type,
                payload.preferred_supplier_id, payload.notes,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM products WHERE id = ?", (pid,)).fetchone()
        return _product(row, conn)
    finally:
        conn.close()


@app.get("/api/products/suggested-purchases")
def suggested_purchases() -> List[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute("SELECT * FROM products").fetchall()
        out = []
        for r in rows:
            st = product_status(r["current"], r["threshold"])
            if st in ("Low Stock", "Out Of Stock"):
                d = _product(r, conn)
                suggested_qty = max(round((r["threshold"] * 2) - r["current"], 2), 1)
                d["suggested_qty"] = suggested_qty
                d["estimated_cost"] = round(suggested_qty * r["cost"], 2)
                out.append(d)
        out.sort(key=lambda p: (p["status"] != "Out Of Stock", p["name"]))
        return out
    finally:
        conn.close()


@app.get("/api/products/{product_id}")
def get_product(product_id: str) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Product not found")
        return _product(row, conn)
    finally:
        conn.close()


@app.put("/api/products/{product_id}")
def update_product(product_id: str, payload: ProductIn) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Product not found")
        conn.execute(
            """UPDATE products SET name=?, sku=?, category=?, unit=?, current=?, threshold=?,
               cost=?, cost_type=?, preferred_supplier_id=?, notes=? WHERE id=?""",
            (
                payload.name, payload.sku, payload.category, payload.unit, payload.current,
                payload.threshold, payload.cost, payload.cost_type,
                payload.preferred_supplier_id, payload.notes, product_id,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        return _product(row, conn)
    finally:
        conn.close()


@app.delete("/api/products/{product_id}", status_code=204)
def delete_product(product_id: str) -> None:
    conn = db.get_conn()
    try:
        conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
        conn.commit()
    finally:
        conn.close()


@app.get("/api/products/{product_id}/transactions")
def product_transactions(product_id: str) -> List[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM transactions WHERE product_id = ? ORDER BY date DESC, created_at DESC",
            (product_id,),
        ).fetchall()
        return [_transaction(r, conn) for r in rows]
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Transactions
# ----------------------------------------------------------------------------
@app.get("/api/transactions")
def list_transactions(
    type: Optional[str] = None,
    product_id: Optional[str] = None,
) -> List[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM transactions ORDER BY date DESC, created_at DESC"
        ).fetchall()
        out = [_transaction(r, conn) for r in rows]
        if type and type != "All":
            out = [t for t in out if t["type"] == type]
        if product_id:
            out = [t for t in out if t["product_id"] == product_id]
        return out
    finally:
        conn.close()


@app.post("/api/transactions", status_code=201)
def create_transaction(payload: TransactionIn) -> dict:
    conn = db.get_conn()
    try:
        prod = conn.execute("SELECT * FROM products WHERE id = ?", (payload.product_id,)).fetchone()
        if not prod:
            raise HTTPException(status_code=404, detail="Product not found")
        if payload.qty == 0:
            raise HTTPException(status_code=400, detail="Quantity must not be zero")
        tid = db.new_id("txn-")
        tx_date = payload.date or date.today().isoformat()
        conn.execute(
            """INSERT INTO transactions (id, date, product_id, qty, unit, type, reason,
               related_po, created_by) VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                tid, tx_date, payload.product_id, payload.qty, prod["unit"], payload.type,
                payload.reason, payload.related_po, payload.created_by,
            ),
        )
        conn.execute(
            "UPDATE products SET current = MAX(0, current + ?) WHERE id = ?",
            (payload.qty, payload.product_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM transactions WHERE id = ?", (tid,)).fetchone()
        return _transaction(row, conn)
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Purchase Orders
# ----------------------------------------------------------------------------
def _save_items(conn: sqlite3.Connection, po_id: str, items: List[POItemIn]) -> None:
    conn.execute("DELETE FROM po_items WHERE po_id = ?", (po_id,))
    for it in items:
        prod = conn.execute("SELECT name FROM products WHERE id = ?", (it.product_id,)).fetchone()
        name = prod["name"] if prod else it.product_id
        conn.execute(
            """INSERT INTO po_items (id, po_id, product_id, product_name, qty, unit,
               unit_price, line_total) VALUES (?,?,?,?,?,?,?,?)""",
            (
                db.new_id("poi-"), po_id, it.product_id, name, it.qty, it.unit,
                it.unit_price, round(it.qty * it.unit_price, 2),
            ),
        )


@app.get("/api/purchase-orders")
def list_pos(
    status: Optional[str] = None,
    supplier_id: Optional[str] = None,
) -> List[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT id FROM purchase_orders ORDER BY activity_date DESC, updated_at DESC"
        ).fetchall()
        out = [_po(r["id"], conn) for r in rows]
        out = [p for p in out if p]
        if status and status != "All":
            out = [p for p in out if p["status"] == status]
        if supplier_id and supplier_id != "All":
            out = [p for p in out if p["supplier_id"] == supplier_id]
        return out
    finally:
        conn.close()


@app.post("/api/purchase-orders", status_code=201)
def create_po(payload: POIn) -> dict:
    conn = db.get_conn()
    try:
        sup = conn.execute("SELECT * FROM suppliers WHERE id = ?", (payload.supplier_id,)).fetchone()
        if not sup:
            raise HTTPException(status_code=400, detail="Supplier not found")
        if not payload.items:
            raise HTTPException(status_code=400, detail="At least one line item is required")
        status = payload.status if payload.status in ("Draft", "Sent", "Completed", "Cancelled") else "Draft"
        prefix = "DRAFT" if status == "Draft" else "PO"
        reference = _next_reference(conn, prefix)
        po_id = db.new_id("po-")
        conn.execute(
            """INSERT INTO purchase_orders (id, reference, supplier_id, status, activity_date, tax_rate)
               VALUES (?,?,?,?,?,?)""",
            (
                po_id, reference, payload.supplier_id, status,
                payload.activity_date or date.today().isoformat(), payload.tax_rate,
            ),
        )
        _save_items(conn, po_id, payload.items)
        conn.commit()
        return _po(po_id, conn)
    finally:
        conn.close()


@app.post("/api/purchase-orders/merge-drafts")
def merge_drafts() -> dict:
    conn = db.get_conn()
    try:
        drafts = conn.execute(
            "SELECT * FROM purchase_orders WHERE status = 'Draft' ORDER BY activity_date"
        ).fetchall()
        by_supplier: dict[str, list] = {}
        for d in drafts:
            by_supplier.setdefault(d["supplier_id"], []).append(d)
        merged = []
        for supplier_id, group in by_supplier.items():
            if len(group) < 2:
                continue
            keep = group[0]
            all_items = []
            for po in group:
                rows = conn.execute("SELECT * FROM po_items WHERE po_id = ?", (po["id"],)).fetchall()
                all_items.extend(rows)
                if po["id"] != keep["id"]:
                    conn.execute("DELETE FROM po_items WHERE po_id = ?", (po["id"],))
                    conn.execute("DELETE FROM purchase_orders WHERE id = ?", (po["id"],))
            conn.execute("DELETE FROM po_items WHERE po_id = ?", (keep["id"],))
            for it in all_items:
                conn.execute(
                    """INSERT INTO po_items (id, po_id, product_id, product_name, qty, unit,
                       unit_price, line_total) VALUES (?,?,?,?,?,?,?,?)""",
                    (
                        db.new_id("poi-"), keep["id"], it["product_id"], it["product_name"],
                        it["qty"], it["unit"], it["unit_price"], it["line_total"],
                    ),
                )
            conn.execute(
                "UPDATE purchase_orders SET updated_at = datetime('now') WHERE id = ?",
                (keep["id"],),
            )
            merged.append(_po(keep["id"], conn))
        conn.commit()
        return {"merged": merged, "count": len(merged)}
    finally:
        conn.close()


@app.get("/api/purchase-orders/{po_id}")
def get_po(po_id: str) -> dict:
    conn = db.get_conn()
    try:
        po = _po(po_id, conn)
        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        return po
    finally:
        conn.close()


@app.put("/api/purchase-orders/{po_id}")
def update_po(po_id: str, payload: POIn) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        status = payload.status if payload.status in ("Draft", "Sent", "Completed", "Cancelled") else row["status"]
        conn.execute(
            """UPDATE purchase_orders SET supplier_id=?, status=?, activity_date=?, tax_rate=?,
               updated_at=datetime('now') WHERE id=?""",
            (
                payload.supplier_id, status,
                payload.activity_date or row["activity_date"], payload.tax_rate, po_id,
            ),
        )
        _save_items(conn, po_id, payload.items)
        conn.commit()
        return _po(po_id, conn)
    finally:
        conn.close()


@app.delete("/api/purchase-orders/{po_id}", status_code=204)
def delete_po(po_id: str) -> None:
    conn = db.get_conn()
    try:
        conn.execute("DELETE FROM purchase_orders WHERE id = ?", (po_id,))
        conn.execute("DELETE FROM po_items WHERE po_id = ?", (po_id,))
        conn.commit()
    finally:
        conn.close()


@app.post("/api/purchase-orders/{po_id}/send")
def send_po(po_id: str) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        reference = row["reference"]
        if reference.startswith("DRAFT-"):
            reference = _next_reference(conn, "PO")
        conn.execute(
            """UPDATE purchase_orders SET status='Sent', reference=?, updated_at=datetime('now')
               WHERE id=?""",
            (reference, po_id),
        )
        conn.commit()
        return _po(po_id, conn)
    finally:
        conn.close()
