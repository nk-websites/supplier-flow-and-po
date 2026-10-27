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
    tax_details: dict = Field(default_factory=dict)
    bank_details: dict = Field(default_factory=dict)
    payment_terms: str = "Net 30"
    contacts: List[ContactIn] = []
    products: List[SupplierProductIn] = []


class SupplierStatusIn(BaseModel):
    status: str


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
    direction: str = "Outbound"
    destination: str = ""
    store: str = ""
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
    purchasing_entity_id: str = ""
    mode: str = "Centralized"
    requesting_store_id: str = ""
    items: List[POItemIn] = []


class ReceivedItemIn(BaseModel):
    item_id: str
    received_qty: float = 0


class GoodsReceiptIn(BaseModel):
    items: List[ReceivedItemIn] = []
    received_date: Optional[str] = None
    received_by: str = ""
    store: str = ""


class SendEmailIn(BaseModel):
    to: List[str] = []
    subject: str = ""
    body: str = ""
    invoice_name: str = ""
    invoice_data: str = ""


class InvoiceIn(BaseModel):
    invoice_name: str = ""
    invoice_data: str = ""


class TransferIn(BaseModel):
    product_id: str
    qty: float
    from_store: str
    to_store: str
    reason: str = ""
    created_by: str = ""
    date: Optional[str] = None


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


def _loads_obj(value: Optional[str]) -> dict:
    """Parse a JSON object column, tolerating legacy/empty values."""
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


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
    d["tax_details"] = _loads_obj(d.get("tax_details"))
    d["bank_details"] = _loads_obj(d.get("bank_details"))
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
    for it in d["items"]:
        allocs = conn.execute(
            "SELECT * FROM po_line_allocations WHERE po_item_id = ? ORDER BY rowid",
            (it["id"],),
        ).fetchall()
        it["allocations"] = [dict(a) for a in allocs]
    d["allocations"] = []
    for it in d["items"]:
        for a in it["allocations"]:
            d["allocations"].append({**a, "product_id": it["product_id"], "product_name": it["product_name"]})
    entity = None
    if d.get("purchasing_entity_id"):
        entity = next(
            (e for e in seed_data.PURCHASING_ENTITIES if e["id"] == d["purchasing_entity_id"]),
            None,
        )
    d["purchasing_entity_name"] = entity["name"] if entity else ""
    subtotal = round(sum(i["line_total"] for i in items), 2)
    d["subtotal"] = subtotal
    # Tax is retired from the UI/PO generation; totals are subtotal-based.
    d["tax_rate"] = 0
    d["tax"] = 0
    d["total"] = subtotal
    d["item_count"] = len(items)
    total_qty = round(sum(i["qty"] or 0 for i in items), 2)
    received_qty = round(sum((i["received_qty"] if "received_qty" in i.keys() else 0) or 0 for i in items), 2)
    d["total_qty"] = total_qty
    d["received_qty"] = received_qty
    d["fully_received"] = total_qty > 0 and received_qty >= total_qty
    d["allocated"] = bool(d["allocations"])
    return d


def _audit(
    conn: sqlite3.Connection,
    entity_type: str,
    entity_id: str,
    action: str,
    actor: str = "",
    reason: str = "",
    detail: str = "",
) -> None:
    conn.execute(
        """INSERT INTO audit_events (id, entity_type, entity_id, action, actor, reason, detail)
           VALUES (?,?,?,?,?,?,?)""",
        (db.new_id("aud-"), entity_type, entity_id, action, actor, reason, detail),
    )


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
        "category_tree": seed_data.CATEGORY_TREE,
        "countries": seed_data.COUNTRIES,
        "country_schemas": seed_data.COUNTRY_SCHEMAS,
        "payment_terms": seed_data.PAYMENT_TERMS,
        "priorities": seed_data.PRIORITIES,
        "contact_roles": seed_data.CONTACT_ROLES,
        "store_email": seed_data.STORE_EMAIL,
        "organization": seed_data.ORGANIZATION,
        "purchasing_entities": seed_data.PURCHASING_ENTITIES,
        "po_modes": ["Centralized", "Store-level"],
        "po_statuses": [
            "Draft",
            "Pending Approval",
            "Approved",
            "Issued",
            "Partially Received",
            "Received",
            "Cancelled",
        ],
        "transaction_types": seed_data.TRANSACTION_TYPES,
        "transaction_directions": seed_data.TRANSACTION_DIRECTIONS,
        "transaction_destinations": seed_data.TRANSACTION_DESTINATIONS,
        "inbound_types": seed_data.INBOUND_TYPES,
        "outbound_types": seed_data.OUTBOUND_TYPES,
        "stores": seed_data.STORES,
        "units": ["kg", "litre", "piece", "dozen", "pack", "gram"],
        "order_statuses": [
            "Draft",
            "Pending Approval",
            "Approved",
            "Issued",
            "Partially Received",
            "Received",
            "Cancelled",
        ],
        "supplier_statuses": ["Active", "Inactive"],
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
            "SELECT COUNT(*) n FROM purchase_orders WHERE status IN ('Draft','Pending Approval','Approved','Issued','Partially Received')"
        ).fetchone()["n"]
        pos = conn.execute("SELECT * FROM purchase_orders").fetchall()
        lifetime_spend = 0.0
        for po in pos:
            if po["status"] in ("Issued", "Partially Received", "Received"):
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
            out = [
                s
                for s in out
                if any(c == category or c.startswith(f"{category} / ") for c in s["categories"])
            ]
        if q:
            ql = q.lower()
            out = [s for s in out if ql in s["name"].lower() or ql in (s["contact_person"] or "").lower()]
        return out
    finally:
        conn.close()


def _insert_supplier(conn: sqlite3.Connection, payload: SupplierIn) -> str:
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
           phone, email, role, address, city, state, country, pincode, gst,
           tax_details, bank_details, payment_terms, contacts)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            sid, code, payload.name, payload.status, json.dumps(payload.categories),
            contact_person, phone, email, payload.role, payload.address, payload.city,
            payload.state, payload.country, payload.pincode, payload.gst,
            json.dumps(payload.tax_details), json.dumps(payload.bank_details),
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
    return sid


@app.post("/api/suppliers", status_code=201)
def create_supplier(payload: SupplierIn) -> dict:
    conn = db.get_conn()
    try:
        sid = _insert_supplier(conn, payload)
        conn.commit()
        row = conn.execute("SELECT * FROM suppliers WHERE id = ?", (sid,)).fetchone()
        return _supplier(row, conn)
    finally:
        conn.close()


class SupplierBulkIn(BaseModel):
    suppliers: List[SupplierIn] = []


@app.post("/api/suppliers/bulk", status_code=201)
def create_suppliers_bulk(payload: SupplierBulkIn) -> dict:
    conn = db.get_conn()
    try:
        created_ids = []
        for sup in payload.suppliers:
            if not sup.name.strip():
                continue
            created_ids.append(_insert_supplier(conn, sup))
        conn.commit()
        out = []
        for sid in created_ids:
            row = conn.execute("SELECT * FROM suppliers WHERE id = ?", (sid,)).fetchone()
            out.append(_supplier(row, conn))
        return {"created": len(out), "suppliers": out}
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
               tax_details=?, bank_details=?, payment_terms=?, contacts=? WHERE id=?""",
            (
                payload.name, json.dumps(payload.categories), payload.status,
                payload.contact_person, payload.phone, payload.email, payload.role,
                payload.address, payload.city, payload.state, payload.country,
                payload.pincode, payload.gst, json.dumps(payload.tax_details),
                json.dumps(payload.bank_details), payload.payment_terms,
                json.dumps(contacts), supplier_id,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM suppliers WHERE id = ?", (supplier_id,)).fetchone()
        return _supplier(row, conn)
    finally:
        conn.close()


@app.patch("/api/suppliers/{supplier_id}/status")
def set_supplier_status(supplier_id: str, payload: SupplierStatusIn) -> dict:
    if payload.status not in ("Active", "Inactive"):
        raise HTTPException(status_code=400, detail="Status must be Active or Inactive")
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM suppliers WHERE id = ?", (supplier_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Supplier not found")
        conn.execute("UPDATE suppliers SET status = ? WHERE id = ?", (payload.status, supplier_id))
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


@app.post("/api/suppliers/{supplier_id}/products", status_code=201)
def add_supplier_product(supplier_id: str, payload: SupplierProductIn) -> dict:
    conn = db.get_conn()
    try:
        sup = conn.execute("SELECT * FROM suppliers WHERE id = ?", (supplier_id,)).fetchone()
        if not sup:
            raise HTTPException(status_code=404, detail="Supplier not found")
        name = payload.name.strip()
        unit = payload.unit
        if payload.product_id:
            prod = conn.execute(
                "SELECT name, unit FROM products WHERE id = ?", (payload.product_id,)
            ).fetchone()
            if not prod:
                raise HTTPException(status_code=404, detail="Product not found")
            name = name or prod["name"]
            unit = prod["unit"] or unit
        if not name:
            raise HTTPException(status_code=400, detail="Product name is required")
        sp_id = db.new_id("sp-")
        conn.execute(
            """INSERT INTO supplier_products (id, supplier_id, product_id, product_name,
               price, unit, priority, moq, last_purchased) VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                sp_id, supplier_id, payload.product_id, name, payload.price, unit,
                payload.priority, payload.moq, "",
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM supplier_products WHERE id = ?", (sp_id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


@app.delete("/api/suppliers/{supplier_id}/products/{sp_id}", status_code=204)
def remove_supplier_product(supplier_id: str, sp_id: str) -> None:
    conn = db.get_conn()
    try:
        conn.execute(
            "DELETE FROM supplier_products WHERE id = ? AND supplier_id = ?",
            (sp_id, supplier_id),
        )
        conn.commit()
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
    direction: Optional[str] = None,
    destination: Optional[str] = None,
) -> List[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT rowid AS rid, * FROM transactions ORDER BY date DESC, created_at DESC"
        ).fetchall()
        out = [_transaction(r, conn) for r in rows]

        # Derive prev/new on-hand quantities per product from the chronological ledger.
        prod_rows = conn.execute("SELECT id, current, cost FROM products").fetchall()
        prod_info = {p["id"]: p for p in prod_rows}
        by_product: dict = {}
        for t in out:
            by_product.setdefault(t["product_id"], []).append(t)
        for pid, items in by_product.items():
            info = prod_info.get(pid)
            current = info["current"] if info else 0
            cost = (info["cost"] if info else 0) or 0
            items.sort(key=lambda t: (t["date"], t.get("created_at") or ""))
            running = max(round(current - sum(t["qty"] for t in items), 2), 0)
            for t in items:
                t["prev_qty"] = round(running, 2)
                running = max(round(running + t["qty"], 2), 0)
                t["new_qty"] = running
                t["net"] = t["qty"]
                t["total_cost"] = round(abs(t["qty"]) * cost, 2)
        # Rowid travels in the dict as "rid"; expose a friendly ledger number.
        for t in out:
            t["txn_no"] = f"#{t.pop('rid', '')}"

        if type and type != "All":
            out = [t for t in out if t["type"] == type]
        if product_id:
            out = [t for t in out if t["product_id"] == product_id]
        if direction and direction != "All":
            out = [t for t in out if t["direction"] == direction]
        if destination and destination != "All":
            out = [t for t in out if t["destination"] == destination]
        return out
    finally:
        conn.close()


@app.get("/api/inventory/summary")
def inventory_summary() -> dict:
    conn = db.get_conn()
    try:
        txns = conn.execute("SELECT qty FROM transactions").fetchall()
        units_in = round(sum((t["qty"] or 0) for t in txns if (t["qty"] or 0) > 0), 2)
        units_out = round(sum(-(t["qty"] or 0) for t in txns if (t["qty"] or 0) < 0), 2)
        prods = conn.execute("SELECT current, cost FROM products").fetchall()
        total_value = round(sum((p["current"] or 0) * (p["cost"] or 0) for p in prods), 2)
        return {
            "units_in": units_in,
            "units_out": units_out,
            "net_change": round(units_in - units_out, 2),
            "total_value": total_value,
        }
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
        direction = payload.direction if payload.direction in ("Inbound", "Outbound") else "Outbound"
        destination = payload.destination if payload.destination in ("Store", "Supplier") else ""
        store = payload.store.strip()
        related_po = payload.related_po.strip()

        if direction == "Outbound":
            if not related_po:
                raise HTTPException(status_code=400, detail="Select the related purchase order")
            po = conn.execute(
                "SELECT * FROM purchase_orders WHERE reference = ?", (related_po,)
            ).fetchone()
            if not po:
                raise HTTPException(status_code=400, detail="Related purchase order not found")
            po_item = conn.execute(
                "SELECT * FROM po_items WHERE po_id = ? AND product_id = ?",
                (po["id"], payload.product_id),
            ).fetchone()
            if not po_item:
                raise HTTPException(
                    status_code=400, detail="This product is not on the selected purchase order"
                )
            existing = conn.execute(
                """SELECT COUNT(*) n FROM transactions WHERE product_id = ?
                   AND related_po = ? AND direction = 'Outbound' AND type != 'Store Transfer'""",
                (payload.product_id, related_po),
            ).fetchone()["n"]
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"An outbound for this item against {related_po} already exists",
                )
            if abs(payload.qty) > (po_item["qty"] or 0):
                raise HTTPException(
                    status_code=400,
                    detail=f"Quantity exceeds the purchase order quantity ({po_item['qty']})",
                )

        tid = db.new_id("txn-")
        tx_date = payload.date or date.today().isoformat()
        conn.execute(
            """INSERT INTO transactions (id, date, product_id, qty, unit, type, direction,
               store, destination, reason, related_po, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                tid, tx_date, payload.product_id, payload.qty, prod["unit"], payload.type,
                direction, store, destination, payload.reason, payload.related_po,
                payload.created_by,
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


@app.post("/api/transactions/transfer", status_code=201)
def transfer_transaction(payload: TransferIn) -> dict:
    conn = db.get_conn()
    try:
        prod = conn.execute("SELECT * FROM products WHERE id = ?", (payload.product_id,)).fetchone()
        if not prod:
            raise HTTPException(status_code=404, detail="Product not found")
        if payload.qty <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than zero")
        from_store = payload.from_store.strip()
        to_store = payload.to_store.strip()
        if not from_store or not to_store or from_store == to_store:
            raise HTTPException(status_code=400, detail="Choose two different stores to transfer between")
        tx_date = payload.date or date.today().isoformat()
        out_id = db.new_id("txn-")
        in_id = db.new_id("txn-")
        conn.execute(
            """INSERT INTO transactions (id, date, product_id, qty, unit, type, direction,
               store, reason, related_po, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                out_id, tx_date, payload.product_id, -abs(payload.qty), prod["unit"],
                "Store Transfer", "Outbound", from_store,
                payload.reason or f"Transfer to {to_store}", "", payload.created_by,
            ),
        )
        conn.execute(
            """INSERT INTO transactions (id, date, product_id, qty, unit, type, direction,
               store, reason, related_po, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                in_id, tx_date, payload.product_id, abs(payload.qty), prod["unit"],
                "Store Transfer", "Inbound", to_store,
                payload.reason or f"Transfer from {from_store}", "", payload.created_by,
            ),
        )
        conn.commit()
        out_row = conn.execute("SELECT * FROM transactions WHERE id = ?", (out_id,)).fetchone()
        in_row = conn.execute("SELECT * FROM transactions WHERE id = ?", (in_id,)).fetchone()
        return {"outbound": _transaction(out_row, conn), "inbound": _transaction(in_row, conn)}
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Replenishment
# ----------------------------------------------------------------------------
_PRIORITY_RANK = {"P0": 0, "P1": 1, "P2": 2}


class ReassignIn(BaseModel):
    product_id: str
    supplier_id: str


def _resolve_supplier(
    conn: sqlite3.Connection, product: sqlite3.Row, mappings_by_product: dict
) -> tuple:
    """Resolve a product to a supplier.

    Returns (supplier_row | None, priority, unit_price, moq, source) where source
    is one of "preferred", "mapping", "category" or "unassigned".
    """
    pid = product["id"]
    cost = product["cost"] or 0
    mapping = None
    if product["preferred_supplier_id"]:
        sup = conn.execute(
            "SELECT * FROM suppliers WHERE id = ?", (product["preferred_supplier_id"],)
        ).fetchone()
        if sup:
            mapping = next(
                (m for m in mappings_by_product.get(pid, []) if m["supplier_id"] == sup["id"]),
                None,
            )
            if mapping:
                return sup, mapping["priority"], mapping["price"], mapping["moq"], "preferred"
            return sup, "", cost, 0, "preferred"

    valid = []
    for m in mappings_by_product.get(pid, []):
        sup = conn.execute("SELECT * FROM suppliers WHERE id = ?", (m["supplier_id"],)).fetchone()
        if sup:
            valid.append((_PRIORITY_RANK.get(m["priority"], 9), m, sup))
    if valid:
        valid.sort(key=lambda x: (x[0], x[1]["price"] or 0))
        _, m, sup = valid[0]
        return sup, m["priority"], m["price"] or cost, m["moq"], "mapping"

    if product["category"]:
        sup = conn.execute(
            "SELECT * FROM suppliers WHERE status = 'Active' AND categories LIKE ? ORDER BY code",
            (f'%"{product["category"]}"%',),
        ).fetchone()
        if sup:
            return sup, "", cost, 0, "category"

    return None, "", cost, 0, "unassigned"


@app.get("/api/replenishment")
def replenishment() -> List[dict]:
    conn = db.get_conn()
    try:
        products = conn.execute("SELECT * FROM products ORDER BY name").fetchall()
        mappings_by_product: dict = {}
        for m in conn.execute("SELECT * FROM supplier_products").fetchall():
            mappings_by_product.setdefault(m["product_id"], []).append(m)

        groups: dict = {}
        for p in products:
            status = product_status(p["current"], p["threshold"])
            if status not in ("Low Stock", "Out Of Stock"):
                continue
            sup, priority, price, moq, source = _resolve_supplier(conn, p, mappings_by_product)
            suggested = max(round((p["threshold"] * 2) - p["current"], 2), moq or 1)
            group_id = sup["id"] if sup else "unassigned"
            item = {
                "product_id": p["id"],
                "name": p["name"],
                "sku": p["sku"],
                "category": p["category"],
                "unit": p["unit"],
                "current": p["current"],
                "threshold": p["threshold"],
                "status": status,
                "suggested_qty": suggested,
                "unit_price": price or p["cost"],
                "priority": priority or "",
                "auto_assigned": source in ("mapping", "category"),
                "assignment_source": source,
                "supplier_id": sup["id"] if sup else None,
                "supplier_name": sup["name"] if sup else "Unassigned",
            }
            group = groups.setdefault(
                group_id,
                {
                    "supplier_id": sup["id"] if sup else None,
                    "supplier_name": sup["name"] if sup else "Unassigned",
                    "priority": priority or "",
                    "items": [],
                },
            )
            group["items"].append(item)
            if priority:
                current = group.get("priority") or "P2"
                if _PRIORITY_RANK.get(priority, 9) < _PRIORITY_RANK.get(current, 9):
                    group["priority"] = priority

        out = []
        for group in groups.values():
            group["subtotal"] = round(
                sum(i["suggested_qty"] * i["unit_price"] for i in group["items"]), 2
            )
            group["item_count"] = len(group["items"])
            out.append(group)

        def sort_key(g: dict):
            if g["supplier_id"] is None:
                return (1, 9, g["supplier_name"])
            return (0, _PRIORITY_RANK.get(g["priority"], 9), g["supplier_name"])

        out.sort(key=sort_key)
        return out
    finally:
        conn.close()


@app.post("/api/replenishment/reassign")
def reassign_product(payload: ReassignIn) -> dict:
    conn = db.get_conn()
    try:
        product = conn.execute(
            "SELECT * FROM products WHERE id = ?", (payload.product_id,)
        ).fetchone()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        supplier = conn.execute(
            "SELECT * FROM suppliers WHERE id = ?", (payload.supplier_id,)
        ).fetchone()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")

        conn.execute(
            "UPDATE products SET preferred_supplier_id = ? WHERE id = ?",
            (payload.supplier_id, payload.product_id),
        )
        existing = conn.execute(
            "SELECT * FROM supplier_products WHERE supplier_id = ? AND product_id = ?",
            (payload.supplier_id, payload.product_id),
        ).fetchone()
        if existing:
            conn.execute(
                """UPDATE supplier_products SET priority = 'P0',
                   price = CASE WHEN price > 0 THEN price ELSE ? END,
                   unit = CASE WHEN unit IS NULL OR unit = '' THEN ? ELSE unit END
                   WHERE id = ?""",
                (product["cost"] or 0, product["unit"], existing["id"]),
            )
        else:
            conn.execute(
                """INSERT INTO supplier_products (id, supplier_id, product_id, product_name,
                   price, unit, priority, moq, last_purchased) VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    db.new_id("sp-"), payload.supplier_id, payload.product_id, product["name"],
                    product["cost"] or 0, product["unit"], "P0", 1, "",
                ),
            )
        conn.commit()
        return {
            "product_id": payload.product_id,
            "supplier_id": payload.supplier_id,
            "supplier_name": supplier["name"],
        }
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
        status = payload.status if payload.status in (
            "Draft", "Pending Approval", "Approved", "Issued", "Partially Received",
            "Received", "Cancelled",
        ) else "Draft"
        prefix = "DRAFT" if status == "Draft" else "PO"
        reference = _next_reference(conn, prefix)
        entity_id = payload.purchasing_entity_id or seed_data.PURCHASING_ENTITIES[0]["id"]
        po_id = db.new_id("po-")
        conn.execute(
            """INSERT INTO purchase_orders (id, reference, supplier_id, status, activity_date, tax_rate,
               organization_id, purchasing_entity_id, mode, requesting_store_id)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                po_id, reference, payload.supplier_id, status,
                payload.activity_date or date.today().isoformat(), 0,
                seed_data.ORGANIZATION["id"], entity_id, payload.mode or "Centralized",
                payload.requesting_store_id,
            ),
        )
        _save_items(conn, po_id, payload.items)
        _audit(conn, "purchase_order", po_id, "created", "", "", reference)
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
        return _po(po_id, conn)
    finally:
        conn.close()


@app.post("/api/purchase-orders/{po_id}/receive")
def receive_po(po_id: str, payload: GoodsReceiptIn) -> dict:
    conn = db.get_conn()
    try:
        po = conn.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,)).fetchone()
        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        if po["status"] in ("Draft", "Pending Approval", "Approved", "Cancelled"):
            raise HTTPException(status_code=400, detail="Only issued purchase orders can be received")

        items = conn.execute("SELECT * FROM po_items WHERE po_id = ?", (po_id,)).fetchall()
        by_id = {i["id"]: i for i in items}
        receipt_date = payload.received_date or date.today().isoformat()
        received_any = False

        for entry in payload.items:
            row = by_id.get(entry.item_id)
            if not row:
                continue
            qty = round(max(entry.received_qty, 0), 2)
            if qty <= 0:
                continue
            received_any = True
            conn.execute("UPDATE po_items SET received_qty = ? WHERE id = ?", (qty, entry.item_id))
            # Record against the destination allocation when one exists.
            alloc = conn.execute(
                """SELECT * FROM po_line_allocations WHERE po_item_id = ? AND store_name = ?
                   ORDER BY rowid LIMIT 1""",
                (entry.item_id, payload.store.strip()),
            ).fetchone()
            if alloc:
                conn.execute(
                    "UPDATE po_line_allocations SET received_qty = ? WHERE id = ?",
                    (min((alloc["received_qty"] or 0) + qty, alloc["qty"] or 0), alloc["id"]),
                )
            conn.execute(
                """INSERT INTO transactions (id, date, product_id, qty, unit, type, direction,
                   store, destination, reason, related_po, created_by)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    db.new_id("txn-"), receipt_date, row["product_id"], qty, row["unit"],
                    "Purchase Receipt", "Inbound", payload.store.strip(), "",
                    "Goods received", po["reference"], payload.received_by,
                ),
            )
            conn.execute(
                "UPDATE products SET current = MAX(0, current + ?) WHERE id = ?",
                (qty, row["product_id"]),
            )

        if not received_any:
            raise HTTPException(status_code=400, detail="Enter a received quantity for at least one item")

        refreshed = conn.execute("SELECT * FROM po_items WHERE po_id = ?", (po_id,)).fetchall()
        fully = len(refreshed) > 0 and all(
            (i["received_qty"] or 0) >= (i["qty"] or 0) for i in refreshed
        )
        status = "Received" if fully else "Partially Received"
        conn.execute(
            """UPDATE purchase_orders SET status=?, received_date=?, received_by=?,
               updated_at=datetime('now') WHERE id=?""",
            (status, receipt_date, payload.received_by, po_id),
        )
        _audit(conn, "purchase_order", po_id, "received", payload.received_by, "", status)
        conn.commit()
        return _po(po_id, conn)
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
        status = payload.status if payload.status in (
            "Draft", "Pending Approval", "Approved", "Issued", "Partially Received",
            "Received", "Cancelled",
        ) else row["status"]
        conn.execute(
            """UPDATE purchase_orders SET supplier_id=?, status=?, activity_date=?, tax_rate=?,
               updated_at=datetime('now') WHERE id=?""",
            (
                payload.supplier_id, status,
                payload.activity_date or row["activity_date"], 0, po_id,
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


@app.post("/api/purchase-orders/{po_id}/send-email")
def send_po_email(po_id: str, payload: SendEmailIn) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        recipients = [r.strip() for r in payload.to if r.strip()]
        if not recipients:
            raise HTTPException(status_code=400, detail="Add at least one recipient email")
        reference = row["reference"]
        if reference.startswith("DRAFT-"):
            reference = _next_reference(conn, "PO")
        conn.execute(
            """UPDATE purchase_orders SET status='Issued', reference=?, email_to=?,
               email_subject=?, email_body=?, email_sent_at=datetime('now'), issued_at=datetime('now'),
               invoice_name=?, invoice_data=?, updated_at=datetime('now') WHERE id=?""",
            (
                reference, ", ".join(recipients), payload.subject, payload.body,
                payload.invoice_name, payload.invoice_data, po_id,
            ),
        )
        _audit(conn, "purchase_order", po_id, "issued", "", "", reference)
        conn.commit()
        return _po(po_id, conn)
    finally:
        conn.close()


@app.post("/api/purchase-orders/{po_id}/invoice")
def set_po_invoice(po_id: str, payload: InvoiceIn) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        conn.execute(
            """UPDATE purchase_orders SET invoice_name=?, invoice_data=?, updated_at=datetime('now')
               WHERE id=?""",
            (payload.invoice_name, payload.invoice_data, po_id),
        )
        conn.commit()
        return _po(po_id, conn)
    finally:
        conn.close()


# ----------------------------------------------------------------------------
# Multi-store procurement: allocations, lifecycle, requests, audit
# ----------------------------------------------------------------------------
class AllocationIn(BaseModel):
    po_item_id: str
    store_id: str
    store_name: str = ""
    qty: float = 0


class AllocationsIn(BaseModel):
    allocations: List[AllocationIn] = []


class ReasonIn(BaseModel):
    actor: str = ""
    reason: str = ""


class PurchaseRequestItemIn(BaseModel):
    product_id: str
    qty: float = 0
    unit: str = "kg"


class PurchaseRequestIn(BaseModel):
    requesting_store_id: str
    requesting_store_name: str = ""
    supplier_id: str
    purchasing_entity_id: str = ""
    requested_by: str = ""
    notes: str = ""
    items: List[PurchaseRequestItemIn] = []


class ConsolidateIn(BaseModel):
    request_ids: List[str] = []
    actor: str = ""
    activity_date: Optional[str] = None


def _request(req_id: str, conn: sqlite3.Connection) -> Optional[dict]:
    row = conn.execute("SELECT * FROM purchase_requests WHERE id = ?", (req_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    sup = conn.execute("SELECT name FROM suppliers WHERE id = ?", (d["supplier_id"],)).fetchone()
    d["supplier_name"] = sup["name"] if sup else ""
    items = conn.execute(
        "SELECT * FROM purchase_request_items WHERE request_id = ? ORDER BY rowid", (req_id,)
    ).fetchall()
    d["items"] = [dict(i) for i in items]
    d["total_qty"] = round(sum(i["qty"] or 0 for i in items), 2)
    return d


@app.get("/api/purchase-requests")
def list_purchase_requests(
    status: Optional[str] = None, store_id: Optional[str] = None
) -> List[dict]:
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT id FROM purchase_requests ORDER BY created_at DESC"
        ).fetchall()
        out = [_request(r["id"], conn) for r in rows]
        out = [r for r in out if r]
        if status and status != "All":
            out = [r for r in out if r["status"] == status]
        if store_id and store_id != "All":
            out = [r for r in out if r["requesting_store_id"] == store_id]
        return out
    finally:
        conn.close()


@app.post("/api/purchase-requests", status_code=201)
def create_purchase_request(payload: PurchaseRequestIn) -> dict:
    conn = db.get_conn()
    try:
        if not payload.items:
            raise HTTPException(status_code=400, detail="Add at least one item")
        n = conn.execute("SELECT COUNT(*) n FROM purchase_requests").fetchone()["n"]
        reference = f"PR-{date.today().year}-{n + 1:03d}"
        rid = db.new_id("pr-")
        conn.execute(
            """INSERT INTO purchase_requests (id, reference, organization_id, purchasing_entity_id,
               supplier_id, requesting_store_id, requesting_store_name, status, requested_by, notes)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                rid, reference, seed_data.ORGANIZATION["id"], payload.purchasing_entity_id,
                payload.supplier_id, payload.requesting_store_id, payload.requesting_store_name,
                "Pending Approval", payload.requested_by, payload.notes,
            ),
        )
        prod_names = {p["id"]: p["name"] for p in conn.execute("SELECT id, name FROM products").fetchall()}
        for it in payload.items:
            conn.execute(
                """INSERT INTO purchase_request_items (id, request_id, product_id, product_name, qty, unit)
                   VALUES (?,?,?,?,?,?)""",
                (db.new_id("pri-"), rid, it.product_id, prod_names.get(it.product_id, ""), it.qty, it.unit),
            )
        _audit(conn, "purchase_request", rid, "created", payload.requested_by, "", reference)
        conn.commit()
        return _request(rid, conn)
    finally:
        conn.close()


@app.post("/api/purchase-requests/{req_id}/approve")
def approve_purchase_request(req_id: str, payload: ReasonIn) -> dict:
    return _set_request_status(req_id, "Approved", payload)


@app.post("/api/purchase-requests/{req_id}/reject")
def reject_purchase_request(req_id: str, payload: ReasonIn) -> dict:
    return _set_request_status(req_id, "Rejected", payload)


def _set_request_status(req_id: str, status: str, payload: ReasonIn) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM purchase_requests WHERE id = ?", (req_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Purchase request not found")
        conn.execute(
            "UPDATE purchase_requests SET status=?, updated_at=datetime('now') WHERE id=?",
            (status, req_id),
        )
        _audit(conn, "purchase_request", req_id, status.lower(), payload.actor, payload.reason)
        conn.commit()
        return _request(req_id, conn)
    finally:
        conn.close()


@app.post("/api/purchase-requests/consolidate", status_code=201)
def consolidate_requests(payload: ConsolidateIn) -> dict:
    conn = db.get_conn()
    try:
        reqs = [_request(rid, conn) for rid in payload.request_ids]
        reqs = [r for r in reqs if r]
        if not reqs:
            raise HTTPException(status_code=400, detail="Select at least one purchase request")
        suppliers = {r["supplier_id"] for r in reqs}
        entities = {r["purchasing_entity_id"] for r in reqs}
        if len(suppliers) > 1:
            raise HTTPException(status_code=400, detail="Cannot consolidate requests from different suppliers")
        if len(entities) > 1:
            raise HTTPException(
                status_code=400, detail="Cannot consolidate requests with different purchasing entities"
            )
        if not next(iter(suppliers)):
            raise HTTPException(status_code=400, detail="Select a supplier on the request first")

        supplier_id = next(iter(suppliers))
        entity_id = next(iter(entities))
        reference = _next_reference(conn, "PO")
        po_id = db.new_id("po-")
        conn.execute(
            """INSERT INTO purchase_orders (id, reference, supplier_id, status, activity_date,
               organization_id, purchasing_entity_id, mode, issued_at, approved_by)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                po_id, reference, supplier_id, "Issued",
                payload.activity_date or date.today().isoformat(),
                seed_data.ORGANIZATION["id"], entity_id, "Centralized",
                datetime_now(), payload.actor,
            ),
        )
        # Group line items by product across requests, and allocate per requesting store.
        item_by_product: dict = {}
        for r in reqs:
            for it in r["items"]:
                key = it["product_id"]
                if key not in item_by_product:
                    item_by_product[key] = {
                        "product_id": it["product_id"],
                        "product_name": it["product_name"],
                        "unit": it["unit"],
                        "qty": 0.0,
                        "allocs": [],
                    }
                item_by_product[key]["qty"] += it["qty"] or 0
                item_by_product[key]["allocs"].append(
                    (r["requesting_store_id"], r["requesting_store_name"], it["qty"] or 0)
                )
        for grp in item_by_product.values():
            price = 0.0
            sp = conn.execute(
                "SELECT price FROM supplier_products WHERE supplier_id = ? AND product_id = ?",
                (supplier_id, grp["product_id"]),
            ).fetchone()
            if sp:
                price = sp["price"] or 0
            po_item_id = db.new_id("poi-")
            conn.execute(
                """INSERT INTO po_items (id, po_id, product_id, product_name, qty, unit, unit_price, line_total)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (
                    po_item_id, po_id, grp["product_id"], grp["product_name"], grp["qty"],
                    grp["unit"], price, round(grp["qty"] * price, 2),
                ),
            )
            for store_id, store_name, qty in grp["allocs"]:
                conn.execute(
                    """INSERT INTO po_line_allocations (id, po_id, po_item_id, store_id, store_name, qty)
                       VALUES (?,?,?,?,?,?)""",
                    (db.new_id("al-"), po_id, po_item_id, store_id, store_name, qty),
                )
        for r in reqs:
            conn.execute(
                "UPDATE purchase_requests SET status='Consolidated', po_id=? WHERE id=?",
                (po_id, r["id"]),
            )
            _audit(conn, "purchase_request", r["id"], "consolidated", payload.actor, "", reference)
        _audit(conn, "purchase_order", po_id, "consolidated", payload.actor, "", reference)
        conn.commit()
        return _po(po_id, conn)
    finally:
        conn.close()


@app.get("/api/audit-events")
def list_audit_events(
    entity_type: Optional[str] = None, entity_id: Optional[str] = None
) -> List[dict]:
    conn = db.get_conn()
    try:
        sql = "SELECT * FROM audit_events"
        clauses = []
        params: List[str] = []
        if entity_type:
            clauses.append("entity_type = ?")
            params.append(entity_type)
        if entity_id:
            clauses.append("entity_id = ?")
            params.append(entity_id)
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY created_at DESC"
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


@app.post("/api/purchase-orders/{po_id}/allocations")
def set_po_allocations(po_id: str, payload: AllocationsIn) -> dict:
    conn = db.get_conn()
    try:
        po = _po(po_id, conn)
        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        items = {i["id"]: i for i in po["items"]}
        # Validate: per line, allocations must not exceed the ordered quantity.
        totals: dict = {}
        for a in payload.allocations:
            if a.po_item_id not in items:
                raise HTTPException(status_code=400, detail="Unknown line item")
            totals[a.po_item_id] = totals.get(a.po_item_id, 0) + (a.qty or 0)
        for item_id, total in totals.items():
            if round(total, 2) > round(items[item_id]["qty"] or 0, 2):
                raise HTTPException(
                    status_code=400,
                    detail=f"Allocated quantity exceeds ordered quantity for {items[item_id]['product_name']}",
                )
        conn.execute("DELETE FROM po_line_allocations WHERE po_id = ?", (po_id,))
        for a in payload.allocations:
            if (a.qty or 0) <= 0:
                continue
            conn.execute(
                """INSERT INTO po_line_allocations (id, po_id, po_item_id, store_id, store_name, qty)
                   VALUES (?,?,?,?,?,?)""",
                (db.new_id("al-"), po_id, a.po_item_id, a.store_id, a.store_name, a.qty),
            )
        conn.execute("UPDATE purchase_orders SET updated_at=datetime('now') WHERE id=?", (po_id,))
        _audit(conn, "purchase_order", po_id, "allocations_updated", "", "")
        conn.commit()
        return _po(po_id, conn)
    finally:
        conn.close()


@app.post("/api/purchase-orders/{po_id}/submit")
def submit_po(po_id: str, payload: ReasonIn) -> dict:
    return _transition_po(po_id, "Draft", "Pending Approval", "submitted", payload)


@app.post("/api/purchase-orders/{po_id}/approve")
def approve_po(po_id: str, payload: ReasonIn) -> dict:
    return _transition_po(po_id, {"Pending Approval"}, "Approved", "approved", payload)


@app.post("/api/purchase-orders/{po_id}/issue")
def issue_po(po_id: str, payload: ReasonIn) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        if row["status"] not in ("Approved", "Draft"):
            raise HTTPException(status_code=400, detail=f"Cannot issue a {row['status']} purchase order")
        reference = row["reference"]
        if reference.startswith("DRAFT-"):
            reference = _next_reference(conn, "PO")
        conn.execute(
            """UPDATE purchase_orders SET status='Issued', reference=?, issued_at=datetime('now'),
               updated_at=datetime('now') WHERE id=?""",
            (reference, po_id),
        )
        _audit(conn, "purchase_order", po_id, "issued", payload.actor, payload.reason)
        conn.commit()
        return _po(po_id, conn)
    finally:
        conn.close()


@app.post("/api/purchase-orders/{po_id}/cancel")
def cancel_po(po_id: str, payload: ReasonIn) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        conn.execute(
            """UPDATE purchase_orders SET status='Cancelled', cancelled_reason=?, updated_at=datetime('now')
               WHERE id=?""",
            (payload.reason, po_id),
        )
        _audit(conn, "purchase_order", po_id, "cancelled", payload.actor, payload.reason)
        conn.commit()
        return _po(po_id, conn)
    finally:
        conn.close()


def _transition_po(po_id: str, allowed_from, to_status: str, action: str, payload: ReasonIn) -> dict:
    conn = db.get_conn()
    try:
        row = conn.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        allowed = {allowed_from} if isinstance(allowed_from, str) else set(allowed_from)
        if row["status"] not in allowed:
            raise HTTPException(status_code=400, detail=f"Cannot {action} a {row['status']} purchase order")
        extra = ""
        params: List = [to_status]
        if to_status == "Pending Approval":
            extra = ", submitted_at=datetime('now')"
        if to_status == "Approved":
            extra = ", approved_by=?, approved_at=datetime('now')"
            params.append(payload.actor)
        params += [po_id]
        conn.execute(
            f"UPDATE purchase_orders SET status=?{extra}, updated_at=datetime('now') WHERE id=?",
            params,
        )
        _audit(conn, "purchase_order", po_id, action, payload.actor, payload.reason)
        conn.commit()
        return _po(po_id, conn)
    finally:
        conn.close()


def datetime_now() -> str:
    return date.today().isoformat()
