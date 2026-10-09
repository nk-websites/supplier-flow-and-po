export type SupplierStatus = "Active" | "Inactive" | "Pending Verification";

export interface Contact {
  name: string;
  phone: string;
  email: string;
  role: string;
  primary?: boolean;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  status: SupplierStatus;
  categories: string[];
  contact_person: string;
  phone: string;
  email: string;
  role: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  gst: string;
  payment_terms: string;
  contacts: Contact[];
  items_count: number;
  created_at?: string;
}

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  product_id: string | null;
  product_name: string;
  price: number;
  unit: string;
  priority: string;
  moq: number;
  last_purchased: string;
}

export type ProductStatus = "In Stock" | "Low Stock" | "Out Of Stock";

export interface Product {
  id: string;
  code: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  current: number;
  threshold: number;
  cost: number;
  cost_type: string;
  preferred_supplier_id: string | null;
  preferred_supplier_name: string;
  notes: string;
  status: ProductStatus;
}

export interface SuggestedPurchase extends Product {
  suggested_qty: number;
  estimated_cost: number;
}

export interface InventoryTransaction {
  id: string;
  date: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  qty: number;
  unit: string;
  type: string;
  reason: string;
  related_po: string;
  created_by: string;
  created_at?: string;
}

export type POStatus = "Draft" | "Sent" | "Completed" | "Cancelled";

export interface POItem {
  id: string;
  po_id: string;
  product_id: string;
  product_name: string;
  qty: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  supplier_id: string;
  supplier_name: string;
  status: POStatus;
  activity_date: string;
  tax_rate: number;
  subtotal: number;
  tax: number;
  total: number;
  item_count: number;
  items: POItem[];
  created_at?: string;
  updated_at?: string;
}

export interface DashboardData {
  kpis: {
    total_suppliers: number;
    low_stock: number;
    out_of_stock: number;
    open_purchase_orders: number;
    lifetime_spend: number;
  };
  recent_transactions: InventoryTransaction[];
  purchase_orders_needing_attention: PurchaseOrder[];
}

export interface Meta {
  categories: string[];
  countries: string[];
  payment_terms: string[];
  priorities: string[];
  transaction_types: string[];
  units: string[];
  order_statuses: POStatus[];
  supplier_statuses: SupplierStatus[];
}
