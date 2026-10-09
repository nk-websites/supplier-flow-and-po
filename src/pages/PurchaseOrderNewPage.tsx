import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Send, Trash2 } from "lucide-react";
import { api, ApiError, type POInput } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatINR } from "@/lib/format";
import { PageHeader } from "@/components/ui/Misc";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/Feedback";
import { Field, Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { POStatus } from "@/types";

interface LineItem {
  key: string;
  product_id: string;
  name: string;
  qty: string;
  unit: string;
  unit_price: string;
}

let seq = 0;
const nextKey = () => `li${++seq}`;

export function PurchaseOrderNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const draftId = params.get("draft");
  const presetSupplier = params.get("supplier") ?? "";

  const { data: suppliers } = useAsync(() => api.suppliers.list(), []);
  const draft = useAsync(
    () => (draftId ? api.purchaseOrders.get(draftId) : Promise.resolve(null)),
    [draftId]
  );

  const [supplierId, setSupplierId] = useState(presetSupplier);
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [taxRate, setTaxRate] = useState("0");
  const [items, setItems] = useState<LineItem[]>([]);
  const [status, setStatus] = useState<POStatus>("Draft");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState("");
  const initialized = useRef(false);

  const supplierProducts = useAsync(
    () => (supplierId ? api.suppliers.products(supplierId) : Promise.resolve([])),
    [supplierId]
  );
  const allProducts = useAsync(() => api.products.list(), []);

  // Preload a draft once.
  useEffect(() => {
    if (!draft.data || initialized.current) return;
    initialized.current = true;
    const po = draft.data;
    setSupplierId(po.supplier_id);
    setDeliveryDate(po.activity_date);
    setTaxRate(String(po.tax_rate ?? 0));
    setStatus(po.status);
    setReference(po.reference);
    setItems(
      po.items.map((it) => ({
        key: nextKey(),
        product_id: it.product_id,
        name: it.product_name,
        qty: String(it.qty),
        unit: it.unit,
        unit_price: String(it.unit_price),
      }))
    );
  }, [draft.data]);

  // Options available to add: supplier's own products when linked, else all products.
  const options = useMemo(() => {
    const linked = (supplierProducts.data ?? []).filter((sp) => sp.product_id);
    if (linked.length) {
      return linked.map((sp) => ({
        id: sp.product_id as string,
        label: sp.product_name || sp.product_id,
        unit: sp.unit,
        price: sp.price,
      }));
    }
    return (allProducts.data ?? []).map((p) => ({
      id: p.id,
      label: p.name,
      unit: p.unit,
      price: p.cost,
    }));
  }, [supplierProducts.data, allProducts.data]);

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0),
    [items]
  );
  const tax = subtotal * (Number(taxRate) || 0) / 100;
  const total = subtotal + tax;

  function addItem() {
    const first = options[0];
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        product_id: first?.id ?? "",
        name: first?.label ?? "",
        qty: "1",
        unit: first?.unit ?? "kg",
        unit_price: first ? String(first.price) : "0",
      },
    ]);
  }

  function selectProduct(key: string, productId: string) {
    const opt = options.find((o) => o.id === productId);
    setItems((prev) =>
      prev.map((it) =>
        it.key === key
          ? {
              ...it,
              product_id: productId,
              name: opt?.label ?? "",
              unit: opt?.unit ?? it.unit,
              unit_price: opt ? String(opt.price) : it.unit_price,
            }
          : it
      )
    );
  }

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function validate(): boolean {
    if (!supplierId) {
      setError("Choose a supplier before saving.");
      return false;
    }
    if (!items.length || items.some((it) => !it.product_id || !(Number(it.qty) > 0))) {
      setError("Add at least one line item with a product and a quantity above zero.");
      return false;
    }
    setError("");
    return true;
  }

  function buildPayload(nextStatus: string): POInput {
    return {
      supplier_id: supplierId,
      status: nextStatus,
      activity_date: deliveryDate,
      tax_rate: Number(taxRate) || 0,
      items: items.map((it) => ({
        product_id: it.product_id,
        qty: Number(it.qty) || 0,
        unit: it.unit,
        unit_price: Number(it.unit_price) || 0,
      })),
    };
  }

  async function saveDraft() {
    if (!validate()) return;
    setSaving("draft");
    try {
      if (draftId) {
        await api.purchaseOrders.update(draftId, buildPayload("Draft"));
      } else {
        await api.purchaseOrders.create(buildPayload("Draft"));
      }
      toast({ title: "Draft saved" });
      navigate("/purchase-orders");
    } catch (err) {
      toast({
        title: "Could not save draft",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
      setSaving(null);
    }
  }

  async function sendToSupplier() {
    if (!validate()) return;
    setSaving("send");
    try {
      if (draftId) {
        await api.purchaseOrders.update(draftId, buildPayload("Draft"));
        await api.purchaseOrders.send(draftId);
      } else {
        await api.purchaseOrders.create(buildPayload("Sent"));
      }
      toast({ title: "Purchase order sent" });
      navigate("/purchase-orders");
    } catch (err) {
      toast({
        title: "Could not send purchase order",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
      setSaving(null);
    }
  }

  const isNew = !draftId;
  const isDraft = status === "Draft";

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/purchase-orders")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to purchase orders
      </button>

      <PageHeader
        title={isNew ? "Raise Purchase Order" : `Purchase Order ${reference}`}
        description={
          isNew
            ? "Select a supplier, add line items, then save a draft or send it."
            : "Review and update this purchase order."
        }
        actions={!isNew ? <StatusBadge status={status} kind="po" /> : undefined}
      />

      {draftId && draft.loading ? (
        <Card>
          <TableSkeleton rows={4} cols={4} />
        </Card>
      ) : draftId && draft.error ? (
        <Card>
          <ErrorState message={draft.error} onRetry={draft.reload} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Order details" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Supplier" required>
                  <Select
                    value={supplierId}
                    onChange={(e) => {
                      setSupplierId(e.target.value);
                      setItems([]);
                    }}
                  >
                    <option value="">Choose a supplier…</option>
                    {(suppliers ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Expected Delivery Date">
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                </Field>
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader
                title="Line items"
                description={supplierId ? "Pick products supplied by the selected vendor." : "Choose a supplier to load their products."}
                actions={
                  <Button variant="outline" size="sm" onClick={addItem} disabled={!supplierId}>
                    <Plus className="h-3.5 w-3.5" />
                    Add item
                  </Button>
                }
              />
              {!supplierId ? (
                <EmptyState title="No supplier selected" description="Select a supplier to start adding products." />
              ) : items.length === 0 ? (
                <EmptyState
                  title="No line items yet"
                  description="Add a product to build this order."
                  action={
                    <Button size="sm" variant="outline" onClick={addItem}>
                      <Plus className="h-3.5 w-3.5" />
                      Add item
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-right">Qty</th>
                        <th>Per Unit</th>
                        <th className="text-right">Unit Price</th>
                        <th className="text-right">Line Total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.key}>
                          <td className="min-w-[180px]">
                            <Select
                              value={it.product_id}
                              onChange={(e) => selectProduct(it.key, e.target.value)}
                            >
                              <option value="">Select product…</option>
                              {options.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                              {it.product_id && !options.some((o) => o.id === it.product_id) && (
                                <option value={it.product_id}>{it.name || "Current item"}</option>
                              )}
                            </Select>
                          </td>
                          <td className="w-28">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.qty}
                              onChange={(e) => updateItem(it.key, { qty: e.target.value })}
                              className="text-right"
                            />
                          </td>
                          <td className="text-muted-foreground">{it.unit}</td>
                          <td className="w-32">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.unit_price}
                              onChange={(e) => updateItem(it.key, { unit_price: e.target.value })}
                              className="text-right"
                            />
                          </td>
                          <td className="text-right font-medium tabular-nums">
                            {formatINR((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Remove line item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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
              <CardHeader title="Summary" />
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">{formatINR(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-muted-foreground">Tax / GST %</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="h-8 w-24 text-right"
                  />
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Tax amount</span>
                  <span className="font-medium tabular-nums">{formatINR(tax)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-base font-semibold tabular-nums text-foreground">
                    {formatINR(total)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Items</span>
                  <span className="font-medium tabular-nums">{items.length}</span>
                </div>
              </CardBody>
              <CardFooter className="flex-col items-stretch gap-2">
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button variant="outline" onClick={saveDraft} loading={saving === "draft"} disabled={saving === "send"}>
                  Save as Draft
                </Button>
                <Button
                  onClick={sendToSupplier}
                  loading={saving === "send"}
                  disabled={(draftId && !isDraft) || saving === "draft"}
                >
                  <Send className="h-4 w-4" />
                  Send to Supplier
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
