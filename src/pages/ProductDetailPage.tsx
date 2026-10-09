import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Pencil,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { api, ApiError, type ProductInput } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatINR } from "@/lib/format";
import { InfoRow, PageHeader } from "@/components/ui/Misc";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/Feedback";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { Product } from "@/types";

export function ProductDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const product = useAsync(() => api.products.get(id), [id]);
  const transactions = useAsync(() => api.products.transactions(id), [id]);
  const suggested = useAsync(() => api.products.suggested(), []);
  const { data: meta } = useAsync(() => api.meta(), []);
  const { data: suppliers } = useAsync(() => api.suppliers.list(), []);

  const [editOpen, setEditOpen] = useState(false);

  if (product.error) {
    return (
      <Card>
        <ErrorState message={product.error} onRetry={product.reload} />
      </Card>
    );
  }

  const p = product.data;
  const suggestion = suggested.data?.find((s) => s.id === id);
  const txs = transactions.data ?? [];

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/inventory/products")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to products
      </button>

      {product.loading || !p ? (
        <TableSkeleton rows={3} cols={4} />
      ) : (
        <>
          <PageHeader
            title={p.name}
            description={`${p.sku || p.code} · ${p.category}`}
            actions={
              <>
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button onClick={() => navigate("/inventory/transactions")}>Record Transaction</Button>
              </>
            }
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader title="Stock & costing" />
                <CardBody className="grid gap-x-8 gap-y-1 pt-2 sm:grid-cols-2">
                  <dl className="divide-y divide-border">
                    <InfoRow label="On hand">
                      {p.current} {p.unit}
                    </InfoRow>
                    <InfoRow label="Reorder threshold">{p.threshold}</InfoRow>
                    <InfoRow label="Status">
                      <StatusBadge status={p.status} kind="product" />
                    </InfoRow>
                  </dl>
                  <dl className="divide-y divide-border">
                    <InfoRow label="Cost / unit">{formatINR(p.cost, { decimals: true })}</InfoRow>
                    <InfoRow label="Cost type">{p.cost_type}</InfoRow>
                    <InfoRow label="Product code">{p.code}</InfoRow>
                  </dl>
                  {p.notes && (
                    <div className="sm:col-span-2">
                      <p className="mt-3 text-[13px] font-medium text-foreground">Notes</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">{p.notes}</p>
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader
                  title="Cost history"
                  description="Purchase price observations for this product."
                />
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Basis</th>
                      <th className="text-right">Cost</th>
                      <th>Per Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-medium text-foreground">{p.cost_type}</td>
                      <td className="text-right tabular-nums">{formatINR(p.cost, { decimals: true })}</td>
                      <td className="text-muted-foreground">{p.unit}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                  Only the latest cost basis is tracked in this build.
                </p>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader title="Recent transactions" description="Movements that changed on-hand stock." />
                {transactions.loading ? (
                  <TableSkeleton rows={3} cols={5} />
                ) : txs.length === 0 ? (
                  <EmptyState title="No transactions" description="No stock movements recorded for this product." />
                ) : (
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th className="text-right">Quantity</th>
                          <th>Reason</th>
                          <th>Created By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txs.map((t) => (
                          <tr key={t.id}>
                            <td className="text-muted-foreground">{formatDate(t.date)}</td>
                            <td>{t.type}</td>
                            <td
                              className={
                                "text-right font-medium tabular-nums " +
                                (t.qty < 0 ? "text-destructive" : "text-success")
                              }
                            >
                              {t.qty > 0 ? "+" : ""}
                              {t.qty} {t.unit}
                            </td>
                            <td className="text-muted-foreground">{t.reason || "—"}</td>
                            <td className="text-muted-foreground">{t.created_by}</td>
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
                <CardHeader title="Preferred supplier" />
                <CardBody className="pt-2">
                  {p.preferred_supplier_name ? (
                    <Link
                      to={`/suppliers/${p.preferred_supplier_id}`}
                      className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{p.preferred_supplier_name}</p>
                        <p className="text-xs text-muted-foreground">View vendor</p>
                      </div>
                    </Link>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">No preferred supplier set.</p>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Suggested purchase" />
                <CardBody className="pt-3">
                  {suggestion ? (
                    <div className="space-y-3">
                      <div
                        className={
                          "flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium " +
                          (suggestion.status === "Out Of Stock"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-warning/10 text-warning")
                        }
                      >
                        {suggestion.status === "Out Of Stock" ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <TrendingUp className="h-4 w-4" />
                        )}
                        {suggestion.status}
                      </div>
                      <dl className="divide-y divide-border">
                        <InfoRow label="On hand">
                          {suggestion.current} {suggestion.unit}
                        </InfoRow>
                        <InfoRow label="Suggested order">
                          {suggestion.suggested_qty} {suggestion.unit}
                        </InfoRow>
                        <InfoRow label="Estimated cost">{formatINR(suggestion.estimated_cost)}</InfoRow>
                      </dl>
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={() =>
                          navigate(
                            p.preferred_supplier_id
                              ? `/purchase-orders/new?supplier=${p.preferred_supplier_id}`
                              : "/purchase-orders/new"
                          )
                        }
                      >
                        Raise purchase order
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">
                      Stock is above the reorder threshold — no purchase suggested.
                    </p>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>

          {editOpen && (
            <EditProductDialog
              product={p}
              categories={meta?.categories ?? [p.category]}
              units={meta?.units ?? [p.unit]}
              suppliers={suppliers ?? []}
              onClose={() => setEditOpen(false)}
              onSaved={() => {
                setEditOpen(false);
                product.reload();
                toast({ title: "Product updated" });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function EditProductDialog({
  product,
  categories,
  units,
  suppliers,
  onClose,
  onSaved,
}: {
  product: Product;
  categories: string[];
  units: string[];
  suppliers: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: product.name,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    current: String(product.current),
    threshold: String(product.threshold),
    cost: String(product.cost),
    cost_type: product.cost_type,
    preferred_supplier_id: product.preferred_supplier_id ?? "",
    notes: product.notes,
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setSaving(true);
    const payload: ProductInput = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category,
      unit: form.unit,
      current: Number(form.current) || 0,
      threshold: Number(form.threshold) || 0,
      cost: Number(form.cost) || 0,
      cost_type: form.cost_type,
      preferred_supplier_id: form.preferred_supplier_id || null,
      notes: form.notes,
    };
    try {
      await api.products.update(product.id, payload);
      onSaved();
    } catch (err) {
      toast({
        title: "Could not update product",
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
      title="Edit product"
      size="lg"
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
        <Field label="Product Name" required>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="SKU Code">
          <Input value={form.sku} onChange={(e) => set({ sku: e.target.value })} />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unit">
          <Select value={form.unit} onChange={(e) => set({ unit: e.target.value })}>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Current Stock">
          <Input type="number" value={form.current} onChange={(e) => set({ current: e.target.value })} />
        </Field>
        <Field label="Reorder Threshold">
          <Input type="number" value={form.threshold} onChange={(e) => set({ threshold: e.target.value })} />
        </Field>
        <Field label="Cost">
          <Input type="number" value={form.cost} onChange={(e) => set({ cost: e.target.value })} />
        </Field>
        <Field label="Cost Type">
          <Select value={form.cost_type} onChange={(e) => set({ cost_type: e.target.value })}>
            <option value="Last Purchase Price">Last Purchase Price</option>
            <option value="Average Cost">Average Cost</option>
          </Select>
        </Field>
        <Field label="Preferred Supplier" className="sm:col-span-2">
          <Select
            value={form.preferred_supplier_id}
            onChange={(e) => set({ preferred_supplier_id: e.target.value })}
          >
            <option value="">No preferred supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Input value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
