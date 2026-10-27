import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, GitMerge, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useStore } from "@/lib/store-context";
import { formatDate } from "@/lib/format";
import { PageHeader, FilterPills } from "@/components/ui/Misc";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type Tone } from "@/components/ui/Badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/Feedback";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { PurchaseRequest } from "@/types";

const prTone: Record<string, Tone> = {
  "Pending Approval": "warning",
  Approved: "info",
  Rejected: "danger",
  Consolidated: "success",
  Draft: "neutral",
};

interface LineDraft {
  key: string;
  product_id: string;
  qty: string;
  unit: string;
}

let seq = 0;
const nextKey = () => `pl${++seq}`;

export function PurchaseRequestsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const requests = useAsync(() => api.purchaseRequests.list(), []);
  const { data: meta } = useAsync(() => api.meta(), []);
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const rows = requests.data ?? [];
  const childStores = (meta?.stores ?? []).filter((s) => s.parent);

  const counts = useMemo(() => {
    const base: Record<string, number> = {
      All: rows.length,
      "Pending Approval": 0,
      Approved: 0,
      Rejected: 0,
      Consolidated: 0,
    };
    rows.forEach((r) => {
      base[r.status] = (base[r.status] ?? 0) + 1;
    });
    return base;
  }, [rows]);

  const filtered = useMemo(
    () => (status === "All" ? rows : rows.filter((r) => r.status === status)),
    [rows, status]
  );

  const eligible = useMemo(
    () => rows.filter((r) => r.status === "Pending Approval" || r.status === "Approved"),
    [rows]
  );

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function decide(req: PurchaseRequest, approve: boolean) {
    setWorking(true);
    try {
      if (approve) await api.purchaseRequests.approve(req.id, "Aarav Mehta");
      else await api.purchaseRequests.reject(req.id, "Rejected by procurement", "Aarav Mehta");
      toast({ title: approve ? "Request approved" : "Request rejected", description: req.reference });
      requests.reload();
    } catch (err) {
      toast({
        title: "Could not update request",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
    } finally {
      setWorking(false);
    }
  }

  async function consolidate() {
    if (!selected.length) return;
    setWorking(true);
    try {
      const po = await api.purchaseRequests.consolidate(selected, "Aarav Mehta");
      toast({
        title: "Consolidated into a purchase order",
        description: `${po.reference} created with ${po.allocations?.length ?? 0} destination allocations.`,
        tone: "success",
      });
      setSelected([]);
      requests.reload();
      navigate(`/purchase-orders/new?draft=${po.id}`);
    } catch (err) {
      toast({
        title: "Could not consolidate",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Requests"
        description="Store demand and parent approval, consolidated into purchase orders."
        actions={
          <>
            <Button
              variant="outline"
              onClick={consolidate}
              loading={working}
              disabled={!selected.length}
            >
              <GitMerge className="h-4 w-4" />
              Consolidate {selected.length ? `(${selected.length})` : ""}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          </>
        }
      />

      <FilterPills
        value={status}
        onChange={setStatus}
        options={[
          { label: "All", value: "All", count: counts.All },
          { label: "Pending Approval", value: "Pending Approval", count: counts["Pending Approval"] },
          { label: "Approved", value: "Approved", count: counts.Approved },
          { label: "Rejected", value: "Rejected", count: counts.Rejected },
          { label: "Consolidated", value: "Consolidated", count: counts.Consolidated },
        ]}
      />

      <Card className="overflow-hidden">
        {requests.loading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : requests.error ? (
          <ErrorState message={requests.error} onRetry={requests.reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title={rows.length === 0 ? "No purchase requests yet" : "No requests match this filter"}
            description={
              rows.length === 0
                ? "Raise a request for products a store needs."
                : "Try a different status."
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="data-table">
              <thead>
                <tr>
                  <th />
                  <th>Reference</th>
                  <th>Store</th>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th className="text-right">Qty</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const selectable = eligible.some((e) => e.id === r.id);
                  return (
                    <tr key={r.id}>
                      <td className="w-8">
                        <input
                          type="checkbox"
                          disabled={!selectable}
                          checked={selected.includes(r.id)}
                          onChange={() => toggle(r.id)}
                          className="h-4 w-4 accent-[hsl(var(--primary))] disabled:opacity-30"
                          aria-label={`Select ${r.reference}`}
                        />
                      </td>
                      <td className="font-medium text-foreground">{r.reference}</td>
                      <td className="text-muted-foreground">{r.requesting_store_name || "—"}</td>
                      <td className="text-muted-foreground">{r.supplier_name || "—"}</td>
                      <td className="text-muted-foreground">
                        {r.items.map((i) => i.product_name).join(", ") || "—"}
                      </td>
                      <td className="text-right tabular-nums text-muted-foreground">{r.total_qty}</td>
                      <td>
                        <Badge tone={prTone[r.status] ?? "neutral"}>{r.status}</Badge>
                      </td>
                      <td className="text-right">
                        {r.status === "Pending Approval" ? (
                          <div className="inline-flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => decide(r, true)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => decide(r, false)}>
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {r.po_id ? "On PO" : formatDate(r.created_at)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {createOpen && (
        <NewRequestDialog
          childStores={childStores.map((s) => ({ id: s.id, name: s.name }))}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            requests.reload();
          }}
        />
      )}
    </div>
  );
}

function NewRequestDialog({
  childStores,
  onClose,
  onCreated,
}: {
  childStores: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const { data: suppliers } = useAsync(() => api.suppliers.list(), []);
  const { data: products } = useAsync(() => api.products.list(), []);
  const { data: meta } = useAsync(() => api.meta(), []);
  const { currentStore } = useStore();

  const defaultStore =
    childStores.find((s) => s.id === currentStore?.id)?.id ?? childStores[0]?.id ?? "";

  const [storeId, setStoreId] = useState(defaultStore);
  const [supplierId, setSupplierId] = useState("");
  const [entityId, setEntityId] = useState(meta?.purchasing_entities?.[0]?.id ?? "pe-1");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    { key: nextKey(), product_id: "", qty: "", unit: "kg" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const storeName = childStores.find((s) => s.id === storeId)?.name ?? "";

  const updateLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function chooseProduct(key: string, productId: string) {
    const p = (products ?? []).find((x) => x.id === productId);
    updateLine(key, { product_id: productId, unit: p?.unit ?? "kg" });
  }

  async function save() {
    const items = lines
      .filter((l) => l.product_id && Number(l.qty) > 0)
      .map((l) => ({ product_id: l.product_id, qty: Number(l.qty), unit: l.unit }));
    if (!storeId) return setError("Select the requesting store");
    if (!supplierId) return setError("Select a supplier");
    if (!items.length) return setError("Add at least one product with a quantity");
    setError("");
    setSaving(true);
    try {
      await api.purchaseRequests.create({
        requesting_store_id: storeId,
        requesting_store_name: storeName,
        supplier_id: supplierId,
        purchasing_entity_id: entityId,
        requested_by: "Aarav Mehta",
        notes: notes.trim(),
        items,
      });
      toast({ title: "Purchase request raised" });
      onCreated();
    } catch (err) {
      toast({
        title: "Could not raise request",
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
      title="New Purchase Request"
      description="A store requests products; the parent procures and approves."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Raise request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Requesting Store" required>
            <Select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">Select store…</option>
              {childStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Supplier" required>
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Select supplier…</option>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Purchasing Entity"
            required
            hint="The legal entity that buys from the supplier and is financially responsible."
          >
            <Select value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              {(meta?.purchasing_entities ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-muted-foreground">Products</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLines((p) => [...p, { key: nextKey(), product_id: "", qty: "", unit: "kg" }])}
            >
              <Plus className="h-3.5 w-3.5" />
              Add product
            </Button>
          </div>
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.key} className="flex items-center gap-2">
                <Select
                  value={l.product_id}
                  onChange={(e) => chooseProduct(l.key, e.target.value)}
                >
                  <option value="">Select product…</option>
                  {(products ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit})
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-24 text-right"
                  value={l.qty}
                  onChange={(e) => updateLine(l.key, { qty: e.target.value })}
                  placeholder="Qty"
                />
                <Select
                  value={l.unit}
                  onChange={(e) => updateLine(l.key, { unit: e.target.value })}
                  className="w-24"
                  aria-label="Unit"
                >
                  {(meta?.units ?? ["kg", "litre", "piece", "dozen", "pack", "gram"]).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
                {lines.length > 1 && (
                  <button
                    onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove product"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <Field label="Notes">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why this request is needed"
          />
        </Field>
      </div>
    </Dialog>
  );
}
