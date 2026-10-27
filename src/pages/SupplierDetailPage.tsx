import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Power,
  Send,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import { api, ApiError, type SupplierInput } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatINR } from "@/lib/format";
import { PageHeader, InfoRow } from "@/components/ui/Misc";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { ChipGroup } from "@/components/ui/Chip";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/Feedback";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, SuggestInput } from "@/components/ui/Input";
import { SchemaFields } from "@/components/SupplierSchemaFields";
import { SendSupplierEmailDialog } from "@/components/SendSupplierEmailDialog";
import { useToast } from "@/components/ui/Toast";
import type { CountrySchemaField, CountrySchemas, Product, PurchaseOrder, Supplier, SupplierProduct } from "@/types";

export function SupplierDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const supplier = useAsync(() => api.suppliers.get(id), [id]);
  const products = useAsync(() => api.suppliers.products(id), [id]);
  const pos = useAsync(() => api.suppliers.purchaseOrders(id), [id]);
  const catalog = useAsync(() => api.products.list(), []);
  const { data: meta } = useAsync(() => api.meta(), []);

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [priceHistory, setPriceHistory] = useState<SupplierProduct | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [emailPo, setEmailPo] = useState<PurchaseOrder | null>(null);
  const [toggling, setToggling] = useState(false);

  if (supplier.error) {
    return (
      <Card>
        <ErrorState message={supplier.error} onRetry={supplier.reload} />
      </Card>
    );
  }

  const s = supplier.data;
  const supplierProducts = products.data ?? [];
  const orders = pos.data ?? [];

  const openPos = orders.filter(
    (p) => !["Received", "Cancelled"].includes(p.status)
  ).length;
  const p0Count = supplierProducts.filter((p) => p.priority === "P0").length;
  const lifetime = orders
    .filter((p) => ["Issued", "Partially Received", "Received"].includes(p.status))
    .reduce((sum, p) => sum + p.total, 0);

  async function toggleStatus() {
    if (!s) return;
    const next = s.status === "Active" ? "Inactive" : "Active";
    setToggling(true);
    try {
      await api.suppliers.setStatus(s.id, next);
      toast({
        title: next === "Active" ? "Supplier activated" : "Supplier deactivated",
        description: `${s.name} is now ${next.toLowerCase()}.`,
        tone: next === "Active" ? "success" : "info",
      });
      supplier.reload();
    } catch (err) {
      toast({
        title: "Could not update status",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
    } finally {
      setToggling(false);
    }
  }

  function sendToSupplier(po: PurchaseOrder) {
    setEmailPo(po);
  }

  async function removeProduct(sp: SupplierProduct) {
    if (!s) return;
    setRemovingId(sp.id);
    try {
      await api.suppliers.removeProduct(s.id, sp.id);
      toast({ title: "Product removed", description: `${sp.product_name} was removed from this supplier.` });
      products.reload();
    } catch (err) {
      toast({
        title: "Could not remove product",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/suppliers")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to suppliers
      </button>

      {supplier.loading || !s ? (
        <TableSkeleton rows={3} cols={4} />
      ) : (
        <>
          <PageHeader
            title={s.name}
            description={`${s.code} · ${s.categories.join(", ") || "Uncategorised"}`}
            actions={
              <>
                <Button variant="outline" loading={toggling} onClick={toggleStatus}>
                  <Power className="h-4 w-4" />
                  {s.status === "Active" ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button onClick={() => navigate(`/purchase-orders/new?supplier=${s.id}`)}>
                  <ShoppingCart className="h-4 w-4" />
                  Raise PO
                </Button>
              </>
            }
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card className="overflow-hidden">
                <CardHeader
                  title="Products supplied"
                  description={`${supplierProducts.length} negotiated item${supplierProducts.length === 1 ? "" : "s"}`}
                  actions={
                    <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                      <Plus className="h-3.5 w-3.5" />
                      Add Product
                    </Button>
                  }
                />
                {products.loading ? (
                  <TableSkeleton rows={3} cols={6} />
                ) : supplierProducts.length === 0 ? (
                  <EmptyState title="No products linked" description="Add products for this supplier to raise POs quickly." />
                ) : (
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th className="text-right">Price</th>
                          <th>Per Unit</th>
                          <th>Priority</th>
                          <th className="text-right">MOQ</th>
                          <th>Last Purchased</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierProducts.map((p) => (
                          <tr key={p.id}>
                            <td className="font-medium text-foreground">{p.product_name || "—"}</td>
                            <td className="text-right tabular-nums">{formatINR(p.price, { decimals: true })}</td>
                            <td className="text-muted-foreground">{p.unit}</td>
                            <td>
                              <PriorityBadge priority={p.priority} />
                            </td>
                            <td className="text-right tabular-nums text-muted-foreground">{p.moq}</td>
                            <td className="text-muted-foreground">{formatDate(p.last_purchased)}</td>
                            <td className="text-right">
                              <div className="inline-flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setPriceHistory(p)}>
                                  View Price History
                                </Button>
                                <button
                                  onClick={() => removeProduct(p)}
                                  disabled={removingId === p.id}
                                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                  aria-label={`Remove ${p.product_name || "product"}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card className="overflow-hidden">
                <CardHeader title="Purchase orders" description="Orders raised with this supplier." />
                {pos.loading ? (
                  <TableSkeleton rows={3} cols={5} />
                ) : orders.length === 0 ? (
                  <EmptyState
                    title="No purchase orders yet"
                    description="Raise a PO to start tracking spend with this vendor."
                    action={
                      <Button size="sm" onClick={() => navigate(`/purchase-orders/new?supplier=${s.id}`)}>
                        Raise PO
                      </Button>
                    }
                  />
                ) : (
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>Activity Date</th>
                          <th className="text-right">Items</th>
                          <th className="text-right">Total</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((po) => (
                          <tr key={po.id}>
                            <td className="font-medium text-foreground">{po.reference}</td>
                            <td className="text-muted-foreground">{formatDate(po.activity_date)}</td>
                            <td className="text-right tabular-nums text-muted-foreground">{po.item_count}</td>
                            <td className="text-right font-medium tabular-nums">{formatINR(po.total)}</td>
                            <td>
                              <StatusBadge status={po.status} kind="po" />
                            </td>
                            <td className="text-right">
                              {po.status === "Draft" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => sendToSupplier(po)}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  Send to Supplier
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/purchase-orders/new?draft=${po.id}`)}
                                >
                                  View
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Vendor" />
                <CardBody className="space-y-4 pt-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Truck className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                      <StatusBadge status={s.status} kind="supplier" />
                    </div>
                  </div>
                  <dl className="divide-y divide-border">
                    <InfoRow label="Primary contact">{s.contact_person || "—"}</InfoRow>
                    <InfoRow label="Phone">
                      {s.phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {s.phone}
                        </span>
                      ) : (
                        "—"
                      )}
                    </InfoRow>
                    <InfoRow label="Email">
                      {s.email ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          {s.email}
                        </span>
                      ) : (
                        "—"
                      )}
                    </InfoRow>
                    <InfoRow label="Location">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {[s.city, s.state, s.country].filter(Boolean).join(", ") || "—"}
                      </span>
                    </InfoRow>
                    <InfoRow label="Payment terms">{s.payment_terms}</InfoRow>
                  </dl>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-muted-foreground">Categories</p>
                    <ChipGroup items={s.categories} />
                  </div>
                </CardBody>
              </Card>

              <TaxBankCard supplier={s} schemas={meta?.country_schemas} />

              <Card>
                <CardHeader title="At a glance" />
                <CardBody className="pt-2">
                  <dl className="divide-y divide-border">
                    <InfoRow label="Products">{supplierProducts.length}</InfoRow>
                    <InfoRow label="P0 items">{p0Count}</InfoRow>
                    <InfoRow label="Open POs">{openPos}</InfoRow>
                    <InfoRow label="Lifetime spend">{formatINR(lifetime)}</InfoRow>
                  </dl>
                </CardBody>
              </Card>
            </div>
          </div>

          {editOpen && (
            <EditSupplierDialog
              supplier={s}
              paymentTerms={meta?.payment_terms ?? ["Net 7", "Net 15", "Net 30", "COD"]}
              countries={meta?.countries ?? ["India"]}
              countrySchemas={meta?.country_schemas ?? {}}
              supplierStatuses={meta?.supplier_statuses ?? ["Active", "Inactive"]}
              contactRoles={meta?.contact_roles ?? []}
              onClose={() => setEditOpen(false)}
              onSaved={() => {
                setEditOpen(false);
                supplier.reload();
              }}
            />
          )}

          {addOpen && (
            <AddProductDialog
              supplierId={s.id}
              catalog={catalog.data ?? []}
              units={meta?.units ?? ["kg", "litre", "piece", "dozen", "pack", "gram"]}
              onClose={() => setAddOpen(false)}
              onSaved={() => {
                setAddOpen(false);
                products.reload();
              }}
            />
          )}

          {emailPo && (
            <SendSupplierEmailDialog
              po={emailPo}
              supplier={s}
              storeEmail={meta?.store_email ?? ""}
              onClose={() => setEmailPo(null)}
              onSent={() => {
                setEmailPo(null);
                pos.reload();
              }}
            />
          )}

          <Dialog
            open={priceHistory !== null}
            onClose={() => setPriceHistory(null)}
            title={`Price history — ${priceHistory?.product_name ?? ""}`}
            description="Recorded purchase prices for this supplier."
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Price</th>
                  <th>Per Unit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{formatDate(priceHistory?.last_purchased)}</td>
                  <td className="text-right tabular-nums">
                    {formatINR(priceHistory?.price ?? 0, { decimals: true })}
                  </td>
                  <td className="text-muted-foreground">{priceHistory?.unit}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              Historical price points beyond the latest purchase are not yet tracked.
            </p>
          </Dialog>
        </>
      )}
    </div>
  );
}

function SchemaSummary({
  title,
  fields,
  values,
}: {
  title: string;
  fields: CountrySchemaField[];
  values: Record<string, string>;
}) {
  const filled = fields.filter((f) => (values[f.key] ?? "").trim());
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-muted-foreground">{title}</p>
      {filled.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Not provided.</p>
      ) : (
        <dl className="divide-y divide-border">
          {filled.map((f) => (
            <InfoRow key={f.key} label={f.label}>
              {values[f.key]}
            </InfoRow>
          ))}
        </dl>
      )}
    </div>
  );
}

function TaxBankCard({ supplier, schemas }: { supplier: Supplier; schemas?: CountrySchemas }) {
  const schema = schemas?.[supplier.country] ?? { tax: [], bank: [] };
  return (
    <Card>
      <CardHeader
        title="Tax & Bank"
        description={`Fields configured for ${supplier.country || "this country"}.`}
      />
      <CardBody className="space-y-4 pt-2">
        <SchemaSummary title="Tax details" fields={schema.tax} values={supplier.tax_details ?? {}} />
        <SchemaSummary title="Bank details" fields={schema.bank} values={supplier.bank_details ?? {}} />
      </CardBody>
    </Card>
  );
}

function AddProductDialog({
  supplierId,
  catalog,
  units,
  onClose,
  onSaved,
}: {
  supplierId: string;
  catalog: Product[];
  units: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"catalog" | "freeform">("catalog");
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState(units[0] ?? "kg");
  const [priority, setPriority] = useState("P1");
  const [moq, setMoq] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function chooseCatalog(id: string) {
    setProductId(id);
    const p = catalog.find((c) => c.id === id);
    if (p) {
      setUnit(p.unit);
      setPrice(String(p.cost));
    }
  }

  async function save() {
    if (mode === "catalog" && !productId) {
      setError("Choose a catalog product");
      return;
    }
    if (mode === "freeform" && !name.trim()) {
      setError("Enter a product name");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await api.suppliers.addProduct(supplierId, {
        product_id: mode === "catalog" ? productId : null,
        name: mode === "freeform" ? name.trim() : "",
        price: Number(price) || 0,
        unit,
        priority,
        moq: Number(moq) || 0,
      });
      toast({ title: "Product added" });
      onSaved();
    } catch (err) {
      toast({
        title: "Could not add product",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
      setSaving(false);
    }
  }

  const modeButton = (value: "catalog" | "freeform", label: string) => (
    <button
      type="button"
      aria-pressed={mode === value}
      onClick={() => setMode(value)}
      className={
        "rounded-md border px-3 py-2 text-[13px] font-medium transition-colors " +
        (mode === value
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </button>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add product"
      description="Map a catalog product or add a custom one for this supplier."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Add product
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Source">
          <div className="grid grid-cols-2 gap-2">
            {modeButton("catalog", "Catalog product")}
            {modeButton("freeform", "Custom product")}
          </div>
        </Field>
        {mode === "catalog" ? (
          <Field label="Product" required error={error}>
            <Select value={productId} onChange={(e) => chooseCatalog(e.target.value)}>
              <option value="">Select a product…</option>
              {catalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Product name" required error={error}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tomatoes" />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price (₹)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Per Unit">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {["P0", "P1", "P2"].map((pr) => (
                <option key={pr} value={pr}>
                  {pr}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="MOQ">
            <Input
              type="number"
              min="0"
              value={moq}
              onChange={(e) => setMoq(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

interface ContactDraft {
  key: string;
  name: string;
  phone: string;
  email: string;
  role: string;
}

let contactSeq = 0;
const nextContactKey = () => `c${++contactSeq}`;

function EditSupplierDialog({
  supplier,
  paymentTerms,
  countries,
  countrySchemas,
  supplierStatuses,
  contactRoles,
  onClose,
  onSaved,
}: {
  supplier: Supplier;
  paymentTerms: string[];
  countries: string[];
  countrySchemas: CountrySchemas;
  supplierStatuses: string[];
  contactRoles: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(supplier.name);
  const [status, setStatus] = useState<string>(supplier.status);
  const [payment, setPayment] = useState(supplier.payment_terms);
  const [city, setCity] = useState(supplier.city);
  const [country, setCountry] = useState(supplier.country || "India");
  const [taxDetails, setTaxDetails] = useState<Record<string, string>>(supplier.tax_details ?? {});
  const [bankDetails, setBankDetails] = useState<Record<string, string>>(supplier.bank_details ?? {});
  const [contacts, setContacts] = useState<ContactDraft[]>(() => {
    const existing = supplier.contacts ?? [];
    if (!existing.length) {
      return [{ key: nextContactKey(), name: "", phone: "", email: "", role: "" }];
    }
    return existing.map((c) => ({
      key: nextContactKey(),
      name: c.name ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      role: c.role ?? "",
    }));
  });

  const schema = countrySchemas?.[country] ?? { tax: [], bank: [] };

  const updateContact = (key: string, patch: Partial<ContactDraft>) =>
    setContacts((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const addContact = () =>
    setContacts((prev) => [...prev, { key: nextContactKey(), name: "", phone: "", email: "", role: "" }]);
  const removeContact = (key: string) =>
    setContacts((prev) => (prev.length > 1 ? prev.filter((c) => c.key !== key) : prev));

  async function save() {
    setSaving(true);
    const primary = contacts[0];
    const payload: SupplierInput = {
      name,
      categories: supplier.categories,
      status,
      contact_person: primary?.name?.trim() ?? "",
      phone: primary?.phone?.trim() ?? "",
      email: primary?.email?.trim() ?? "",
      role: primary?.role?.trim() ?? "",
      address: supplier.address,
      city,
      state: supplier.state,
      country,
      pincode: supplier.pincode,
      gst: taxDetails.gstin ?? supplier.gst,
      tax_details: taxDetails,
      bank_details: bankDetails,
      payment_terms: payment,
      contacts: contacts
        .filter((c) => c.name.trim() || c.phone.trim() || c.email.trim())
        .map((c, i) => ({
          name: c.name.trim(),
          phone: c.phone.trim(),
          email: c.email.trim(),
          role: c.role.trim(),
          primary: i === 0,
        })),
    };
    try {
      await api.suppliers.update(supplier.id, payload);
      toast({ title: "Supplier updated" });
      onSaved();
    } catch (err) {
      toast({
        title: "Could not update supplier",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit supplier"
      description="Update key vendor details."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier Name" required className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {supplierStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Payment Terms">
          <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
            {paymentTerms.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="City">
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label="Country">
          <Select value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-muted-foreground">Contact persons</p>
          <Button variant="outline" size="sm" onClick={addContact}>
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </Button>
        </div>
        {contacts.map((c, index) => (
          <div key={c.key} className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-medium text-foreground">
                Contact {index + 1}
                {index === 0 && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    Primary
                  </span>
                )}
              </span>
              {index > 0 && (
                <button
                  onClick={() => removeContact(c.key)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remove contact ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Contact Name" required={index === 0}>
                <Input
                  value={c.name}
                  onChange={(e) => updateContact(c.key, { name: e.target.value })}
                  placeholder="Full name"
                />
              </Field>
              <Field label="Phone" required={index === 0}>
                <Input
                  value={c.phone}
                  onChange={(e) => updateContact(c.key, { phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={c.email}
                  onChange={(e) => updateContact(c.key, { email: e.target.value })}
                  placeholder="name@company.com"
                />
              </Field>
              <Field label="Role / Designation">
                <SuggestInput
                  suggestions={contactRoles}
                  value={c.role}
                  onChange={(e) => updateContact(c.key, { role: e.target.value })}
                  placeholder="e.g. Procurement, Sales Manager"
                />
              </Field>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-4">
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted-foreground">Tax details</p>
          <SchemaFields
            fields={schema.tax}
            values={taxDetails}
            onChange={(k, v) => setTaxDetails((prev) => ({ ...prev, [k]: v }))}
          />
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted-foreground">Bank details</p>
          <SchemaFields
            fields={schema.bank}
            values={bankDetails}
            onChange={(k, v) => setBankDetails((prev) => ({ ...prev, [k]: v }))}
          />
        </div>
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge tone="neutral">Note</Badge>
        Categories are preserved from the original supplier record.
      </p>
    </Dialog>
  );
}
