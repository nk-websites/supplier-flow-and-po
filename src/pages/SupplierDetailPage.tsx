import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Send,
  ShoppingCart,
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
import { Field, Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { PurchaseOrder, Supplier, SupplierProduct } from "@/types";

export function SupplierDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const supplier = useAsync(() => api.suppliers.get(id), [id]);
  const products = useAsync(() => api.suppliers.products(id), [id]);
  const pos = useAsync(() => api.suppliers.purchaseOrders(id), [id]);
  const { data: meta } = useAsync(() => api.meta(), []);

  const [editOpen, setEditOpen] = useState(false);
  const [priceHistory, setPriceHistory] = useState<SupplierProduct | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

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

  const openPos = orders.filter((p) => p.status === "Draft" || p.status === "Sent").length;
  const p0Count = supplierProducts.filter((p) => p.priority === "P0").length;
  const lifetime = orders
    .filter((p) => p.status === "Sent" || p.status === "Completed")
    .reduce((sum, p) => sum + p.total, 0);

  async function sendToSupplier(po: PurchaseOrder) {
    setSendingId(po.id);
    try {
      const updated = await api.purchaseOrders.send(po.id);
      toast({
        title: "Purchase order sent",
        description: `${updated.reference} was sent to ${updated.supplier_name}.`,
      });
      pos.reload();
    } catch (err) {
      toast({
        title: "Could not send purchase order",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
    } finally {
      setSendingId(null);
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
                              <Button variant="ghost" size="sm" onClick={() => setPriceHistory(p)}>
                                View Price History
                              </Button>
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
                                  loading={sendingId === po.id}
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
                    <InfoRow label="GST / Tax ID">{s.gst || "—"}</InfoRow>
                  </dl>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-muted-foreground">Categories</p>
                    <ChipGroup items={s.categories} />
                  </div>
                </CardBody>
              </Card>

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
              supplierStatuses={meta?.supplier_statuses ?? ["Active", "Inactive", "Pending Verification"]}
              onClose={() => setEditOpen(false)}
              onSaved={() => {
                setEditOpen(false);
                supplier.reload();
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

function EditSupplierDialog({
  supplier,
  paymentTerms,
  countries,
  supplierStatuses,
  onClose,
  onSaved,
}: {
  supplier: Supplier;
  paymentTerms: string[];
  countries: string[];
  supplierStatuses: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(supplier.name);
  const [status, setStatus] = useState<string>(supplier.status);
  const [payment, setPayment] = useState(supplier.payment_terms);
  const [contact, setContact] = useState(supplier.contact_person);
  const [phone, setPhone] = useState(supplier.phone);
  const [email, setEmail] = useState(supplier.email);
  const [city, setCity] = useState(supplier.city);
  const [country, setCountry] = useState(supplier.country || "India");

  async function save() {
    setSaving(true);
    const payload: SupplierInput = {
      name,
      categories: supplier.categories,
      status,
      contact_person: contact,
      phone,
      email,
      role: supplier.role,
      address: supplier.address,
      city,
      state: supplier.state,
      country,
      pincode: supplier.pincode,
      gst: supplier.gst,
      payment_terms: payment,
      contacts: supplier.contacts,
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
        <Field label="Contact Person">
          <Input value={contact} onChange={(e) => setContact(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
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
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge tone="neutral">Note</Badge>
        Categories and contacts are preserved from the original supplier record.
      </p>
    </Dialog>
  );
}
