import type {
  AuditEvent,
  Contact,
  DashboardData,
  InventorySummary,
  InventoryTransaction,
  Meta,
  MovementDestination,
  MovementDirection,
  POItem,
  Product,
  PurchaseOrder,
  PurchaseRequest,
  ReplenishmentGroup,
  SuggestedPurchase,
  Supplier,
  SupplierProduct,
} from "@/types";

const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      /* keep default */
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface SupplierInput {
  name: string;
  code?: string;
  categories: string[];
  status: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  role?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  gst?: string;
  tax_details?: Record<string, string>;
  bank_details?: Record<string, string>;
  payment_terms: string;
  contacts: Contact[];
  products?: {
    product_id?: string | null;
    name: string;
    price: number;
    unit: string;
    priority: string;
    moq: number;
  }[];
}

export interface ProductInput {
  name: string;
  code?: string;
  sku?: string;
  category: string;
  unit: string;
  current: number;
  threshold: number;
  cost: number;
  cost_type: string;
  preferred_supplier_id?: string | null;
  notes?: string;
}

export interface TransactionInput {
  product_id: string;
  qty: number;
  type: string;
  direction: MovementDirection;
  destination?: MovementDestination | "";
  store?: string;
  reason?: string;
  related_po?: string;
  created_by?: string;
  date?: string;
}

export interface POInput {
  supplier_id: string;
  status?: string;
  activity_date?: string;
  purchasing_entity_id?: string;
  mode?: string;
  requesting_store_id?: string;
  items: { product_id: string; qty: number; unit: string; unit_price: number }[];
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
  if (!entries.length) return "";
  return `?${new URLSearchParams(entries as [string, string][]).toString()}`;
}

export const api = {
  meta: () => request<Meta>("/meta"),

  dashboard: () => request<DashboardData>("/dashboard"),

  suppliers: {
    list: (params: { status?: string; category?: string; q?: string } = {}) =>
      request<Supplier[]>(`/suppliers${qs(params)}`),
    get: (id: string) => request<Supplier>(`/suppliers/${id}`),
    create: (body: SupplierInput) =>
      request<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(body) }),
    bulk: (suppliers: SupplierInput[]) =>
      request<{ created: number; suppliers: Supplier[] }>("/suppliers/bulk", {
        method: "POST",
        body: JSON.stringify({ suppliers }),
      }),
    update: (id: string, body: SupplierInput) =>
      request<Supplier>(`/suppliers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/suppliers/${id}`, { method: "DELETE" }),
    products: (id: string) => request<SupplierProduct[]>(`/suppliers/${id}/products`),
    addProduct: (
      id: string,
      body: {
        product_id?: string | null;
        name?: string;
        price: number;
        unit: string;
        priority: string;
        moq: number;
      }
    ) =>
      request<SupplierProduct>(`/suppliers/${id}/products`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    removeProduct: (id: string, spId: string) =>
      request<void>(`/suppliers/${id}/products/${spId}`, { method: "DELETE" }),
    purchaseOrders: (id: string) => request<PurchaseOrder[]>(`/suppliers/${id}/purchase-orders`),
    setStatus: (id: string, status: Supplier["status"]) =>
      request<Supplier>(`/suppliers/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
  },

  products: {
    list: (params: { category?: string; unit?: string; status?: string; q?: string } = {}) =>
      request<Product[]>(`/products${qs(params)}`),
    get: (id: string) => request<Product>(`/products/${id}`),
    create: (body: ProductInput) =>
      request<Product>("/products", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: ProductInput) =>
      request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/products/${id}`, { method: "DELETE" }),
    suggested: () => request<SuggestedPurchase[]>("/products/suggested-purchases"),
    transactions: (id: string) => request<InventoryTransaction[]>(`/products/${id}/transactions`),
  },

  transactions: {
    list: (
      params: {
        type?: string;
        product_id?: string;
        direction?: string;
        destination?: string;
      } = {}
    ) => request<InventoryTransaction[]>(`/transactions${qs(params)}`),
    create: (body: TransactionInput) =>
      request<InventoryTransaction>("/transactions", { method: "POST", body: JSON.stringify(body) }),
    transfer: (body: {
      product_id: string;
      qty: number;
      from_store: string;
      to_store: string;
      reason?: string;
      created_by?: string;
      date?: string;
    }) =>
      request<{ outbound: InventoryTransaction; inbound: InventoryTransaction }>(
        "/transactions/transfer",
        { method: "POST", body: JSON.stringify(body) }
      ),
    summary: () => request<InventorySummary>("/inventory/summary"),
  },

  replenishment: {
    list: () => request<ReplenishmentGroup[]>("/replenishment"),
    reassign: (product_id: string, supplier_id: string) =>
      request<{ product_id: string; supplier_id: string; supplier_name: string }>(
        "/replenishment/reassign",
        { method: "POST", body: JSON.stringify({ product_id, supplier_id }) }
      ),
  },

  purchaseOrders: {
    list: (params: { status?: string; supplier_id?: string } = {}) =>
      request<PurchaseOrder[]>(`/purchase-orders${qs(params)}`),
    get: (id: string) => request<PurchaseOrder>(`/purchase-orders/${id}`),
    create: (body: POInput) =>
      request<PurchaseOrder>("/purchase-orders", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: POInput) =>
      request<PurchaseOrder>(`/purchase-orders/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/purchase-orders/${id}`, { method: "DELETE" }),
    send: (id: string) => request<PurchaseOrder>(`/purchase-orders/${id}/send`, { method: "POST" }),
    sendEmail: (
      id: string,
      body: {
        to: string[];
        subject: string;
        body: string;
        invoice_name?: string;
        invoice_data?: string;
      }
    ) =>
      request<PurchaseOrder>(`/purchase-orders/${id}/send-email`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    uploadInvoice: (id: string, body: { invoice_name: string; invoice_data: string }) =>
      request<PurchaseOrder>(`/purchase-orders/${id}/invoice`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    receive: (
      id: string,
      body: {
        items: { item_id: string; received_qty: number }[];
        received_date?: string;
        received_by?: string;
        store?: string;
      }
    ) =>
      request<PurchaseOrder>(`/purchase-orders/${id}/receive`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    mergeDrafts: () =>
      request<{ merged: PurchaseOrder[]; count: number }>("/purchase-orders/merge-drafts", {
        method: "POST",
      }),
    setAllocations: (
      id: string,
      allocations: { po_item_id: string; store_id: string; store_name: string; qty: number }[]
    ) =>
      request<PurchaseOrder>(`/purchase-orders/${id}/allocations`, {
        method: "POST",
        body: JSON.stringify({ allocations }),
      }),
    submit: (id: string, actor = "") =>
      request<PurchaseOrder>(`/purchase-orders/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ actor }),
      }),
    approve: (id: string, actor = "") =>
      request<PurchaseOrder>(`/purchase-orders/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ actor }),
      }),
    issue: (id: string, actor = "") =>
      request<PurchaseOrder>(`/purchase-orders/${id}/issue`, {
        method: "POST",
        body: JSON.stringify({ actor }),
      }),
    cancel: (id: string, reason = "", actor = "") =>
      request<PurchaseOrder>(`/purchase-orders/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason, actor }),
      }),
  },

  purchaseRequests: {
    list: (params: { status?: string; store_id?: string } = {}) =>
      request<PurchaseRequest[]>(`/purchase-requests${qs(params)}`),
    create: (body: {
      requesting_store_id: string;
      requesting_store_name?: string;
      supplier_id: string;
      purchasing_entity_id?: string;
      requested_by?: string;
      notes?: string;
      items: { product_id: string; qty: number; unit: string }[];
    }) =>
      request<PurchaseRequest>("/purchase-requests", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    approve: (id: string, actor = "") =>
      request<PurchaseRequest>(`/purchase-requests/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ actor }),
      }),
    reject: (id: string, reason = "", actor = "") =>
      request<PurchaseRequest>(`/purchase-requests/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason, actor }),
      }),
    consolidate: (request_ids: string[], actor = "") =>
      request<PurchaseOrder>("/purchase-requests/consolidate", {
        method: "POST",
        body: JSON.stringify({ request_ids, actor }),
      }),
  },

  auditEvents: (params: { entity_type?: string; entity_id?: string } = {}) =>
    request<AuditEvent[]>(`/audit-events${qs(params)}`),
};

export type { POItem };
