import { useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Eye,
  FileText,
  PackageCheck,
  PackagePlus,
  Paperclip,
  Plus,
  Repeat,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatINR } from "@/lib/format";
import { PageHeader, FilterPills } from "@/components/ui/Misc";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/Feedback";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Input";
import { SendSupplierEmailDialog } from "@/components/SendSupplierEmailDialog";
import { useStore } from "@/lib/store-context";
import { useToast } from "@/components/ui/Toast";
import type { PurchaseOrder, ReplenishmentGroup, ReplenishmentItem, Supplier } from "@/types";

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const orders = useAsync(() => api.purchaseOrders.list(), []);
  const suppliers = useAsync(() => api.suppliers.list(), []);
  const replenishment = useAsync(() => api.replenishment.list(), []);
  const { data: meta } = useAsync(() => api.meta(), []);
  const [status, setStatus] = useState("Draft");
  const [supplierId, setSupplierId] = useState("All");
  const [generating, setGenerating] = useState(false);
  const [changeItem, setChangeItem] = useState<ReplenishmentItem | null>(null);
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);
  const [invoicePo, setInvoicePo] = useState<PurchaseOrder | null>(null);
  const [sendDialog, setSendDialog] = useState<{ po: PurchaseOrder; supplier: Supplier | null } | null>(
    null
  );

  const allOrders = orders.data ?? [];
  const groups = replenishment.data ?? [];
  const activeSuppliers = useMemo(
    () => (suppliers.data ?? []).filter((s) => s.status === "Active"),
    [suppliers.data]
  );

  const counts = useMemo(() => {
    const base: Record<string, number> = {
      Draft: 0,
      "Pending Approval": 0,
      Approved: 0,
      Issued: 0,
      Received: 0,
      Cancelled: 0,
    };
    allOrders.forEach((o) => {
      if (o.status === "Partially Received") base.Received += 1;
      else base[o.status] = (base[o.status] ?? 0) + 1;
    });
    return base;
  }, [allOrders]);

  const matchesStatus = (po: PurchaseOrder, key: string) =>
    key === "Received"
      ? po.status === "Received" || po.status === "Partially Received"
      : po.status === key;

  const filtered = useMemo(
    () =>
      allOrders.filter((o) => {
        if (!matchesStatus(o, status)) return false;
        if (supplierId !== "All" && o.supplier_id !== supplierId) return false;
        return true;
      }),
    [allOrders, status, supplierId]
  );

  async function reassign(item: ReplenishmentItem, newSupplierId: string) {
    if (!newSupplierId || newSupplierId === item.supplier_id) return;
    try {
      const res = await api.replenishment.reassign(item.product_id, newSupplierId);
      toast({
        title: "Product reassigned",
        description: `${item.name} moved to ${res.supplier_name}.`,
        tone: "success",
      });
      replenishment.reload();
      suppliers.reload();
    } catch (err) {
      toast({
        title: "Could not reassign product",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
    }
  }

  async function sendGroup(group: ReplenishmentGroup) {
    if (!group.supplier_id) return;
    setGenerating(true);
    try {
      const po = await api.purchaseOrders.create({
        supplier_id: group.supplier_id,
        status: "Draft",
        activity_date: new Date().toISOString().slice(0, 10),
        items: group.items.map((it) => ({
          product_id: it.product_id,
          qty: it.suggested_qty,
          unit: it.unit,
          unit_price: it.unit_price,
        })),
      });
      const supplier = (suppliers.data ?? []).find((s) => s.id === group.supplier_id) ?? null;
      setSendDialog({ po, supplier });
      orders.reload();
      replenishment.reload();
    } catch (err) {
      toast({
        title: "Could not create purchase order",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function deletePo(po: PurchaseOrder) {
    if (!window.confirm(`Delete ${po.reference}? This cannot be undone.`)) return;
    try {
      await api.purchaseOrders.remove(po.id);
      toast({ title: "Purchase order deleted", description: `${po.reference} was deleted.` });
      orders.reload();
    } catch (err) {
      toast({
        title: "Could not delete purchase order",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Draft, send, and track orders across suppliers."
        actions={
          status === "Draft" ? (
            <Button onClick={() => navigate("/purchase-orders/new")}>
              <Plus className="h-4 w-4" />
              Raise New PO
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          value={status}
          onChange={setStatus}
          options={[
            { label: "Replenishment", value: "Draft", count: counts.Draft },
            { label: "Pending Approval", value: "Pending Approval", count: counts["Pending Approval"] },
            { label: "Approved", value: "Approved", count: counts.Approved },
            { label: "Issued", value: "Issued", count: counts.Issued },
            { label: "Received", value: "Received", count: counts.Received },
            { label: "Cancelled", value: "Cancelled", count: counts.Cancelled },
          ]}
        />
        <Select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="ml-auto w-52"
        >
          <option value="All">All suppliers</option>
          {(suppliers.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      {status === "Draft" ? (
        <ReplenishmentView
          groups={groups}
          loading={replenishment.loading}
          error={replenishment.error}
          onRetry={replenishment.reload}
          supplierId={supplierId}
          onChangeSupplier={setChangeItem}
          onSend={sendGroup}
          onAddItem={(group) => navigate(`/purchase-orders/new?supplier=${group.supplier_id}`)}
          generating={generating}
        />
      ) : (
        <Card className="overflow-hidden">
          {orders.loading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : orders.error ? (
            <ErrorState message={orders.error} onRetry={orders.reload} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="h-5 w-5" />}
              title="No purchase orders match your filters"
              description="Try a different status or supplier."
            />
          ) : (
            <OrdersTable
              orders={filtered}
              onEdit={(id) => navigate(`/purchase-orders/new?draft=${id}`)}
              onReceive={setReceivePo}
              onDelete={deletePo}
              onInvoice={setInvoicePo}
            />
          )}
        </Card>
      )}

      {changeItem && (
        <ChangeSupplierDialog
          item={changeItem}
          suppliers={activeSuppliers}
          onClose={() => setChangeItem(null)}
          onConfirm={(nextId) => {
            reassign(changeItem, nextId);
            setChangeItem(null);
          }}
        />
      )}

      {receivePo && (
        <ReceiveGoodsDialog
          po={receivePo}
          onClose={() => setReceivePo(null)}
          onSaved={() => {
            setReceivePo(null);
            orders.reload();
          }}
        />
      )}

      {sendDialog && (
        <SendSupplierEmailDialog
          po={sendDialog.po}
          supplier={sendDialog.supplier}
          storeEmail={meta?.store_email ?? ""}
          onClose={() => setSendDialog(null)}
          onSent={() => {
            setSendDialog(null);
            orders.reload();
            replenishment.reload();
          }}
        />
      )}

      {invoicePo && (
        <InvoiceDialog
          po={invoicePo}
          onClose={() => setInvoicePo(null)}
          onSaved={() => {
            setInvoicePo(null);
            orders.reload();
          }}
        />
      )}
    </div>
  );
}

function OrdersTable({
  orders,
  onEdit,
  onReceive,
  onDelete,
  onInvoice,
}: {
  orders: PurchaseOrder[];
  onEdit: (id: string) => void;
  onReceive: (po: PurchaseOrder) => void;
  onDelete: (po: PurchaseOrder) => void;
  onInvoice: (po: PurchaseOrder) => void;
}) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="data-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Supplier</th>
            <th className="text-right">Items</th>
            <th className="text-right">Received</th>
            <th className="text-right">Total</th>
            <th>Last Updated</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((po) => {
            const partial = po.received_qty > 0 && !po.fully_received;
            return (
              <tr key={po.id}>
                <td className="font-medium text-foreground">{po.reference}</td>
                <td className="text-muted-foreground">{po.supplier_name}</td>
                <td className="text-right tabular-nums text-muted-foreground">{po.item_count}</td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {po.received_qty > 0 || po.fully_received ? (
                    <span className={po.fully_received ? "text-success" : "text-warning"}>
                      {po.received_qty} / {po.total_qty}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {partial && <span className="ml-1.5 text-[11px] text-muted-foreground">partial</span>}
                </td>
                <td className="text-right font-semibold tabular-nums">{formatINR(po.total)}</td>
                <td className="text-muted-foreground">
                  {formatDate(po.updated_at || po.activity_date)}
                </td>
                <td>
                  <StatusBadge status={po.status} kind="po" />
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    {(po.status === "Issued" || po.status === "Partially Received") && (
                      <Button size="sm" variant="outline" onClick={() => onReceive(po)}>
                        <PackageCheck className="h-3.5 w-3.5" />
                        Receive Goods
                      </Button>
                    )}
                    <IconAction label={`View ${po.reference}`} onClick={() => onEdit(po.id)}>
                      <Eye className="h-4 w-4" />
                    </IconAction>
                    {po.status !== "Draft" && (
                      <IconAction
                        label={
                          po.invoice_name
                            ? `Invoice attached to ${po.reference}`
                            : `Attach supplier invoice to ${po.reference}`
                        }
                        onClick={() => onInvoice(po)}
                        className={po.invoice_name ? "text-success" : undefined}
                      >
                        <FileText className="h-4 w-4" />
                      </IconAction>
                    )}
                    {po.status === "Issued" && (
                      <IconAction
                        label={`Delete ${po.reference}`}
                        danger
                        onClick={() => onDelete(po)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconAction>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  danger,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:border-input " +
        (danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-muted hover:text-foreground") +
        (className ? ` ${className}` : "")
      }
    >
      {children}
    </button>
  );
}

function ReplenishmentView({
  groups,
  loading,
  error,
  onRetry,
  supplierId,
  onChangeSupplier,
  onSend,
  onAddItem,
  generating,
}: {
  groups: ReplenishmentGroup[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  supplierId: string;
  onChangeSupplier: (item: ReplenishmentItem) => void;
  onSend: (group: ReplenishmentGroup) => void;
  onAddItem: (group: ReplenishmentGroup) => void;
  generating: boolean;
}) {
  const visible = groups.filter(
    (g) => g.supplier_id && (supplierId === "All" || g.supplier_id === supplierId)
  );

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary-soft/40">
        <CardBody className="flex items-start gap-3 pt-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" strokeWidth={1.9} />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Smart replenishment</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Suggested items are grouped by supplier from products at or below their reorder threshold,
              assigned automatically by supplier priority. Reassign any product to move it to another
              supplier, then send orders directly to suppliers.
            </p>
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <Card>
          <TableSkeleton rows={5} cols={6} />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={onRetry} />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PackagePlus className="h-5 w-5" />}
            title="Nothing needs replenishing"
            description="All tracked products are above their reorder thresholds."
          />
        </Card>
      ) : (
        visible.map((group) => (
          <Card key={group.supplier_id ?? "unassigned"} className="overflow-hidden">
            <CardHeader
              title={group.supplier_name}
              description={`${group.item_count} suggested item${group.item_count === 1 ? "" : "s"} · subtotal ${formatINR(group.subtotal)}`}
              actions={
                <div className="flex items-center gap-2">
                  {group.priority && <PriorityBadge priority={group.priority} />}
                  <Button size="sm" variant="outline" onClick={() => onAddItem(group)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </Button>
                  <Button
                    size="sm"
                    disabled={!group.supplier_id || generating}
                    onClick={() => onSend(group)}
                  >
                    Send to Supplier
                  </Button>
                </div>
              }
            />
            <div className="overflow-x-auto scrollbar-thin">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Stock</th>
                    <th className="text-right">Suggested Qty</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Line Total</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.product_id}>
                      <td>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.sku}</p>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                            {item.current} / {item.threshold} {item.unit}
                          </span>
                          <StatusBadge status={item.status} kind="product" />
                        </div>
                      </td>
                      <td className="text-right tabular-nums">
                        {item.suggested_qty} {item.unit}
                      </td>
                      <td className="text-right tabular-nums text-muted-foreground">
                        {formatINR(item.unit_price, { decimals: true })}
                      </td>
                      <td className="text-right font-semibold tabular-nums">
                        {formatINR(item.suggested_qty * item.unit_price)}
                      </td>
                      <td className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => onChangeSupplier(item)}>
                          <Repeat className="h-3.5 w-3.5" />
                          Change Supplier
                        </Button>
                        {item.auto_assigned && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Auto-assigned</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function ChangeSupplierDialog({
  item,
  suppliers,
  onClose,
  onConfirm,
}: {
  item: ReplenishmentItem;
  suppliers: { id: string; name: string }[];
  onClose: () => void;
  onConfirm: (supplierId: string) => void;
}) {
  const [selected, setSelected] = useState(item.supplier_id ?? "");
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Change supplier — ${item.name}`}
      description="Move this product to another supplier's replenishment group."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!selected || selected === item.supplier_id}
            onClick={() => onConfirm(selected)}
          >
            Move product
          </Button>
        </>
      }
    >
      <Field label="Supplier" required>
        <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select supplier…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <p className="mt-2 text-xs text-muted-foreground">
        Currently with {item.supplier_name}. Moving it will reassign the product and shift it to the
        new supplier's group.
      </p>
    </Dialog>
  );
}

function ReceiveGoodsDialog({
  po,
  onClose,
  onSaved,
}: {
  po: PurchaseOrder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { currentStore } = useStore();
  const [qtys, setQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      po.items.map((it) => [it.id, String(Math.max(it.qty - it.received_qty, 0))])
    )
  );
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receivedBy, setReceivedBy] = useState("Aarav Mehta");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentStoreName = currentStore?.name ?? "";

  async function save() {
    const items = po.items
      .map((it) => ({ item_id: it.id, received_qty: Number(qtys[it.id]) || 0 }))
      .filter((x) => x.received_qty > 0);
    if (!items.length) {
      setError("Enter a received quantity for at least one item.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await api.purchaseOrders.receive(po.id, {
        items,
        received_date: date,
        received_by: receivedBy.trim(),
        store: currentStoreName,
      });
      toast({
        title: "Goods received",
        description: `Stock updated against ${po.reference}.`,
      });
      onSaved();
    } catch (err) {
      toast({
        title: "Could not save receipt",
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
      title={`Received Goods — ${po.reference}`}
      description="Enter the quantities received. Stock is updated and inbound transactions are recorded."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save Receipt
          </Button>
        </>
      }
    >
      <div className="overflow-x-auto scrollbar-thin">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-right">Requested Qty</th>
              <th className="text-right">Received Qty</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((it) => (
              <tr key={it.id}>
                <td className="font-medium text-foreground">{it.product_name}</td>
                <td className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                  {it.qty} {it.unit}
                </td>
                <td className="w-32">
                  <Input
                    type="number"
                    min="0"
                    max={it.qty}
                    step="0.01"
                    value={qtys[it.id] ?? ""}
                    onChange={(e) => setQtys((prev) => ({ ...prev, [it.id]: e.target.value }))}
                    className="text-right"
                    aria-label={`Received quantity for ${it.product_name}`}
                  />
                </td>
                <td className="text-muted-foreground">{it.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Received Date" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Received By">
          <Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
        </Field>
        <Field
          label="Received Into Store"
          className="sm:col-span-2"
          hint="Goods are always received into the current store."
        >
          <Input value={currentStoreName} disabled readOnly />
        </Field>
      </div>
    </Dialog>
  );
}

function InvoiceDialog({
  po,
  onClose,
  onSaved,
}: {
  po: PurchaseOrder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(po.invoice_name ?? "");
  const [data, setData] = useState(po.invoice_data ?? "");
  const [saving, setSaving] = useState(false);

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setName(file.name);
      setData(String(reader.result ?? ""));
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      await api.purchaseOrders.uploadInvoice(po.id, { invoice_name: name, invoice_data: data });
      toast({ title: name ? "Invoice attached" : "Invoice removed" });
      onSaved();
    } catch (err) {
      toast({
        title: "Could not save invoice",
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
      title={`Supplier invoice — ${po.reference}`}
      description="Upload the invoice the supplier sent for this order."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      {name ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
          <span className="inline-flex items-center gap-2 truncate text-[13px] text-foreground">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{name}</span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={data}
              download={name}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
            <button
              onClick={() => {
                setName("");
                setData("");
              }}
              className="text-[13px] text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">No invoice attached yet.</p>
      )}
      <div className="mt-4">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Paperclip className="h-3.5 w-3.5" />
          {name ? "Replace invoice" : "Upload invoice"}
        </Button>
      </div>
    </Dialog>
  );
}
