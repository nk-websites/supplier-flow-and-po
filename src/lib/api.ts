import type {
  Contact,
  DashboardData,
  InventoryTransaction,
  Meta,
  POItem,
  Product,
  PurchaseOrder,
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
  reason?: string;
  related_po?: string;
  created_by?: string;
  date?: string;
}

export interface POInput {
  supplier_id: string;
  status?: string;
  activity_date?: string;
  tax_rate?: number;
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
    update: (id: string, body: SupplierInput) =>
      request<Supplier>(`/suppliers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/suppliers/${id}`, { method: "DELETE" }),
    products: (id: string) => request<SupplierProduct[]>(`/suppliers/${id}/products`),
    purchaseOrders: (id: string) => request<PurchaseOrder[]>(`/suppliers/${id}/purchase-orders`),
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
    list: (params: { type?: string; product_id?: string } = {}) =>
      request<InventoryTransaction[]>(`/transactions${qs(params)}`),
    create: (body: TransactionInput) =>
      request<InventoryTransaction>("/transactions", { method: "POST", body: JSON.stringify(body) }),
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
    mergeDrafts: () =>
      request<{ merged: PurchaseOrder[]; count: number }>("/purchase-orders/merge-drafts", {
        method: "POST",
      }),
  },
};

export type { POItem };
