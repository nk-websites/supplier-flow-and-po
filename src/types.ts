export type SupplierStatus = "Active" | "Inactive";

export interface Contact {
  name: string;
  phone: string;
  email: string;
  role: string;
  primary?: boolean;
}

export interface CountrySchemaField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export interface CountrySchema {
  tax: CountrySchemaField[];
  bank: CountrySchemaField[];
}

export type CountrySchemas = Record<string, CountrySchema>;

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
  tax_details: Record<string, string>;
  bank_details: Record<string, string>;
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

export type MovementDirection = "Inbound" | "Outbound";
export type MovementDestination = "Store" | "Supplier";

export interface Store {
  id: string;
  name: string;
  parent: string | null;
}

export interface CategoryNode {
  name: string;
  children?: CategoryNode[];
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
  direction: MovementDirection;
  destination: MovementDestination | "";
  store: string;
  reason: string;
  related_po: string;
  created_by: string;
  created_at?: string;
  txn_no: string;
  prev_qty: number;
  new_qty: number;
  net: number;
  total_cost: number;
}

export interface InventorySummary {
  units_in: number;
  units_out: number;
  net_change: number;
  total_value: number;
}

export type POStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Issued"
  | "Partially Received"
  | "Received"
  | "Cancelled";

export interface Allocation {
  id: string;
  po_id: string;
  po_item_id: string;
  store_id: string;
  store_name: string;
  qty: number;
  received_qty: number;
  product_id?: string;
  product_name?: string;
}

export interface POItem {
  id: string;
  po_id: string;
  product_id: string;
  product_name: string;
  qty: number;
  unit: string;
  unit_price: number;
  line_total: number;
  received_qty: number;
  allocations: Allocation[];
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  supplier_id: string;
  supplier_name: string;
  status: POStatus;
  activity_date: string;
  subtotal: number;
  total: number;
  item_count: number;
  items: POItem[];
  total_qty: number;
  received_qty: number;
  fully_received: boolean;
  received_date?: string;
  received_by?: string;
  email_to?: string;
  email_subject?: string;
  email_body?: string;
  email_sent_at?: string;
  invoice_name?: string;
  invoice_data?: string;
  organization_id?: string;
  purchasing_entity_id?: string;
  purchasing_entity_name?: string;
  mode?: string;
  requesting_store_id?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  issued_at?: string;
  cancelled_reason?: string;
  allocated?: boolean;
  allocations?: Allocation[];
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseRequestItem {
  id: string;
  request_id: string;
  product_id: string;
  product_name: string;
  qty: number;
  unit: string;
}

export interface PurchaseRequest {
  id: string;
  reference: string;
  organization_id: string;
  purchasing_entity_id: string;
  supplier_id: string;
  supplier_name: string;
  requesting_store_id: string;
  requesting_store_name: string;
  status: string;
  requested_by: string;
  notes: string;
  po_id: string;
  items: PurchaseRequestItem[];
  total_qty: number;
  created_at?: string;
  updated_at?: string;
}

export interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  reason: string;
  detail: string;
  created_at: string;
}

export interface ReplenishmentItem {
  product_id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  current: number;
  threshold: number;
  status: ProductStatus;
  suggested_qty: number;
  unit_price: number;
  priority: string;
  auto_assigned: boolean;
  assignment_source: "preferred" | "mapping" | "category" | "unassigned";
  supplier_id: string | null;
  supplier_name: string;
}

export interface ReplenishmentGroup {
  supplier_id: string | null;
  supplier_name: string;
  priority: string;
  items: ReplenishmentItem[];
  subtotal: number;
  item_count: number;
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
  category_tree: CategoryNode[];
  countries: string[];
  country_schemas: CountrySchemas;
  payment_terms: string[];
  priorities: string[];
  contact_roles: string[];
  store_email: string;
  transaction_types: string[];
  transaction_directions: MovementDirection[];
  transaction_destinations: MovementDestination[];
  inbound_types: string[];
  outbound_types: string[];
  stores: Store[];
  units: string[];
  order_statuses: POStatus[];
  supplier_statuses: SupplierStatus[];
  organization: { id: string; name: string };
  purchasing_entities: { id: string; name: string; organization_id: string; currency: string }[];
  po_modes: string[];
  po_statuses: POStatus[];
}
