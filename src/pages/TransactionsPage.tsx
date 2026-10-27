import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  IndianRupee,
  Plus,
  Scale,
} from "lucide-react";
import { api, ApiError, type TransactionInput } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatINR, formatNumber, formatQty } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui/Misc";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TransactionTypeBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/Feedback";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { MovementDirection } from "@/types";

const FALLBACK_INBOUND = ["Purchase Receipt", "Return", "Manual Adjustment"];
const FALLBACK_OUTBOUND = ["Waste", "Expired", "Damaged", "Manual Adjustment", "Return to Supplier"];

export function TransactionsPage() {
  const { toast } = useToast();
  const { data, loading, error, reload } = useAsync(() => api.transactions.list(), []);
  const summary = useAsync(() => api.transactions.summary(), []);
  const [type, setType] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);

  const transactions = data ?? [];
  const kpis = summary.data;
  const net = kpis?.net_change ?? 0;

  const types = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => set.add(t.type));
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(
    () => (type === "All" ? transactions : transactions.filter((t) => t.type === type)),
    [transactions, type]
  );

  function exportCsv() {
    const header = [
      "Date/Time",
      "Type",
      "Direction",
      "Store",
      "SKU",
      "Prev Qty",
      "New Qty",
      "Net",
      "Unit",
      "Processed By",
      "Reason",
      "Related PO",
      "Total Cost",
    ];
    const rows = transactions.map((t) => [
      t.created_at ? t.created_at.slice(0, 16) : t.date,
      t.type,
      t.direction,
      t.store,
      `${t.product_name} (${t.product_sku})`,
      t.prev_qty,
      t.new_qty,
      t.net,
      t.unit,
      t.created_by,
      t.reason,
      t.related_po,
      t.total_cost,
    ]);
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? "");
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "transaction-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Transactions"
        description="Every movement that changed on-hand stock."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!transactions.length}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New Transaction
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Units In"
          value={formatNumber(kpis?.units_in ?? 0)}
          icon={ArrowDownToLine}
          tone="success"
        />
        <StatCard
          label="Units Out"
          value={formatNumber(kpis?.units_out ?? 0)}
          icon={ArrowUpFromLine}
          tone="danger"
        />
        <StatCard
          label="Net Change"
          value={
            <span className={net >= 0 ? "text-success" : "text-destructive"}>{formatQty(net)}</span>
          }
          icon={Scale}
          tone="info"
        />
        <StatCard
          label="Inventory Value"
          value={formatINR(kpis?.total_value ?? 0)}
          icon={IndianRupee}
          tone="primary"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Transaction History"
          description={`${filtered.length} record${filtered.length === 1 ? "" : "s"}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={type} onChange={(e) => setType(e.target.value)} className="w-52">
                <option value="All">All transaction types</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        {loading ? (
          <TableSkeleton rows={8} cols={9} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight className="h-5 w-5" />}
            title={transactions.length === 0 ? "No transactions yet" : "No transactions match these filters"}
            description={
              transactions.length === 0
                ? "Record a movement to start tracking stock changes."
                : "Try a different movement, destination, or type."
            }
            action={
              transactions.length === 0 ? (
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  New Transaction
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>Type</th>
                  <th>Txn No</th>
                  <th>SKU</th>
                  <th>Store</th>
                  <th className="text-right">Prev Qty</th>
                  <th className="text-right">New Qty</th>
                  <th className="text-right">Net</th>
                  <th>Processed By</th>
                  <th>Reason</th>
                  <th className="text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {t.created_at ? t.created_at.slice(0, 16) : formatDate(t.date)}
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <TransactionTypeBadge type={t.type} />
                        <span className="text-[11px] text-muted-foreground">{t.direction}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {t.txn_no}
                    </td>
                    <td>
                      <p className="font-medium text-foreground">{t.product_name}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{t.product_sku}</p>
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">{t.store || "—"}</td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {formatNumber(t.prev_qty)}
                    </td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {formatNumber(t.new_qty)}
                    </td>
                    <td
                      className={
                        "text-right font-semibold tabular-nums " +
                        (t.net < 0 ? "text-destructive" : t.net > 0 ? "text-success" : "text-muted-foreground")
                      }
                    >
                      {t.net > 0 ? "+" : ""}
                      {formatNumber(t.net)}
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">{t.created_by || "—"}</td>
                    <td className="text-muted-foreground">
                      {t.reason || "—"}
                      {t.related_po && (
                        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                          {t.related_po}
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{formatINR(t.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dialogOpen && (
        <NewTransactionDialog
          onClose={() => setDialogOpen(false)}
          onCreated={() => {
            setDialogOpen(false);
            reload();
            summary.reload();
            toast({ title: "Transaction recorded" });
          }}
        />
      )}
    </div>
  );
}

function NewTransactionDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const { data: products } = useAsync(() => api.products.list(), []);
  const { data: meta } = useAsync(() => api.meta(), []);
  const { data: orders } = useAsync(() => api.purchaseOrders.list(), []);
  const [productId, setProductId] = useState("");
  const [mode, setMode] = useState<MovementDirection | "Transfer">("Outbound");
  const [relatedPo, setRelatedPo] = useState("");
  const [store, setStore] = useState("");
  const [fromStore, setFromStore] = useState("");
  const [toStore, setToStore] = useState("");
  const [type, setType] = useState("Waste");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [createdBy, setCreatedBy] = useState("Aarav Mehta");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stores = meta?.stores ?? [];
  const returnableOrders = (orders ?? []).filter(
    (o) => o.status === "Draft" || o.status === "Pending Approval" || o.status === "Approved"
  );
  const selectedOrder = returnableOrders.find((o) => o.reference === relatedPo);
  const productOptions = useMemo(() => {
    if (mode === "Outbound" && selectedOrder) {
      return selectedOrder.items.map((it) => ({
        id: it.product_id,
        name: it.product_name,
        unit: it.unit,
        max: it.qty as number | undefined,
        current: undefined as number | undefined,
      }));
    }
    return (products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      max: undefined as number | undefined,
      current: p.current,
    }));
  }, [mode, selectedOrder, products]);
  const selectedOption = productOptions.find((o) => o.id === productId);
  const inboundTypes = meta?.inbound_types ?? FALLBACK_INBOUND;
  const outboundTypes = meta?.outbound_types ?? FALLBACK_OUTBOUND;
  const typeOptions = mode === "Inbound" ? inboundTypes : outboundTypes;

  function chooseMode(next: MovementDirection | "Transfer") {
    setMode(next);
    if (next === "Outbound" && !outboundTypes.includes(type)) setType(outboundTypes[0]);
    if (next === "Inbound" && !inboundTypes.includes(type)) setType(inboundTypes[0]);
  }

  async function save() {
    if (!productId) {
      setError("Select a product");
      return;
    }
    const qty = Number(amount);
    if (!qty || qty <= 0) {
      setError("Enter a quantity greater than zero");
      return;
    }
    if (mode === "Transfer") {
      if (!fromStore || !toStore) {
        setError("Choose the source and destination stores");
        return;
      }
      if (fromStore === toStore) {
        setError("Source and destination stores must be different");
        return;
      }
      setError("");
      setSaving(true);
      try {
        await api.transactions.transfer({
          product_id: productId,
          qty,
          from_store: fromStore,
          to_store: toStore,
          reason: reason.trim(),
          created_by: createdBy.trim(),
          date,
        });
        onCreated();
      } catch (err) {
        toast({
          title: "Could not record transfer",
          description: err instanceof ApiError ? err.message : "Unexpected error",
          tone: "error",
        });
        setSaving(false);
      }
      return;
    }
    if (mode === "Outbound" && !relatedPo) {
      setError("Select the related purchase order");
      return;
    }
    if (!store) {
      setError("Select a store");
      return;
    }
    setError("");
    const payload: TransactionInput = {
      product_id: productId,
      qty: mode === "Outbound" ? -qty : qty,
      type,
      direction: mode,
      destination: "",
      store,
      reason: reason.trim(),
      related_po: mode === "Outbound" ? relatedPo : "",
      created_by: createdBy.trim(),
      date,
    };
    setSaving(true);
    try {
      await api.transactions.create(payload);
      onCreated();
    } catch (err) {
      toast({
        title: "Could not record transaction",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
      setSaving(false);
    }
  }

  const modeButton = (value: MovementDirection | "Transfer", label: string, tone: string) => (
    <button
      type="button"
      onClick={() => chooseMode(value)}
      aria-pressed={mode === value}
      className={
        "rounded-md border px-3 py-2 text-[13px] font-medium transition-colors " +
        (mode === value
          ? `border-primary/40 bg-primary/10 text-primary ${tone}`
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
      title="New Transaction"
      description="Record an inventory movement. Stock is updated automatically."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Record transaction
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {error && (
          <p className="text-xs text-destructive sm:col-span-2" role="alert">
            {error}
          </p>
        )}
        <Field label="Movement" required className="sm:col-span-2">
          <div className="grid grid-cols-3 gap-2">
            {modeButton("Inbound", "Inbound (+)", "text-success")}
            {modeButton("Outbound", "Outbound (−)", "text-destructive")}
            {modeButton("Transfer", "Store Transfer", "")}
          </div>
        </Field>

        {mode === "Outbound" && (
          <Field
            label="Related PO"
            required
            className="sm:col-span-2"
            hint="Outbound must be recorded against the purchase order it came in on."
          >
            <Select
              value={relatedPo}
              onChange={(e) => {
                setRelatedPo(e.target.value);
                setProductId("");
              }}
            >
              <option value="">Select a purchase order…</option>
              {returnableOrders.map((o) => (
                <option key={o.id} value={o.reference}>
                  {o.reference} — {o.supplier_name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Product" required className="sm:col-span-2">
          <Select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={mode === "Outbound" && !relatedPo}
          >
            <option value="">
              {mode === "Outbound" && !relatedPo ? "Select a purchase order first…" : "Select a product…"}
            </option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.max != null ? ` — ${p.max} ${p.unit} on PO` : p.current != null ? ` (${p.current} ${p.unit})` : ""}
              </option>
            ))}
          </Select>
        </Field>

        {mode === "Transfer" ? (
          <>
            <Field label="From Store" required>
              <Select value={fromStore} onChange={(e) => setFromStore(e.target.value)}>
                <option value="">Select source store…</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="To Store" required>
              <Select value={toStore} onChange={(e) => setToStore(e.target.value)}>
                <option value="">Select destination store…</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <>
            <Field label={mode === "Outbound" ? "From Store" : "To Store"} required>
              <Select value={store} onChange={(e) => setStore(e.target.value)}>
                <option value="">Select a store…</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Transaction Type" required>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}

        <Field
          label="Quantity"
          required
          hint={
            selectedOption
              ? `Unit: ${selectedOption.unit}${selectedOption.max != null ? ` · max ${selectedOption.max}` : ""}`
              : undefined
          }
        >
          <Input
            type="number"
            min="0"
            max={selectedOption?.max}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>

        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="Created By">
          <Input value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} />
        </Field>

        <Field label="Reason" className="sm:col-span-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Spoilage, Stock Count Correction"
          />
        </Field>
      </div>
    </Dialog>
  );
}
