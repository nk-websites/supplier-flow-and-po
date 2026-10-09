import { useMemo, useState } from "react";
import { ArrowLeftRight, Plus } from "lucide-react";
import { api, ApiError, type TransactionInput } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatQty } from "@/lib/format";
import { PageHeader } from "@/components/ui/Misc";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TransactionTypeBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/Feedback";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export function TransactionsPage() {
  const { toast } = useToast();
  const { data, loading, error, reload } = useAsync(() => api.transactions.list(), []);
  const [type, setType] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);

  const transactions = data ?? [];

  const filtered = useMemo(
    () => (type === "All" ? transactions : transactions.filter((t) => t.type === type)),
    [transactions, type]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Transactions"
        description="Every movement that changed on-hand stock."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New Transaction
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <CardHeader
          title="Transaction History"
          description={`${filtered.length} record${filtered.length === 1 ? "" : "s"}`}
          actions={
            <Select value={type} onChange={(e) => setType(e.target.value)} className="w-48">
              <option value="All">All transaction types</option>
              {["Waste", "Expired", "Damaged", "Manual Adjustment", "Purchase Receipt", "Return"].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                )
              )}
            </Select>
          }
        />
        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight className="h-5 w-5" />}
            title={transactions.length === 0 ? "No transactions yet" : "No transactions of this type"}
            description={
              transactions.length === 0
                ? "Record a movement to start tracking stock changes."
                : "Try a different transaction type."
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
                  <th>Date</th>
                  <th>Product</th>
                  <th className="text-right">Quantity</th>
                  <th>Transaction Type</th>
                  <th>Related PO</th>
                  <th>Reason</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap text-muted-foreground">{formatDate(t.date)}</td>
                    <td>
                      <p className="font-medium text-foreground">{t.product_name}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{t.product_sku}</p>
                    </td>
                    <td
                      className={
                        "text-right font-semibold tabular-nums " +
                        (t.qty < 0 ? "text-destructive" : "text-success")
                      }
                    >
                      {formatQty(t.qty)} {t.unit}
                    </td>
                    <td>
                      <TransactionTypeBadge type={t.type} />
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">{t.related_po || "—"}</td>
                    <td className="text-muted-foreground">{t.reason || "—"}</td>
                    <td className="text-muted-foreground">{t.created_by}</td>
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
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState<"decrease" | "increase">("decrease");
  const [type, setType] = useState("Waste");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [relatedPo, setRelatedPo] = useState("");
  const [createdBy, setCreatedBy] = useState("Aarav Mehta");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selected = (products ?? []).find((p) => p.id === productId);

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
    setError("");
    const payload: TransactionInput = {
      product_id: productId,
      qty: direction === "decrease" ? -qty : qty,
      type,
      reason: reason.trim(),
      related_po: relatedPo.trim(),
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
        <Field label="Product" required className="sm:col-span-2" error={error}>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select a product…</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.current} {p.unit})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Direction" required>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection("decrease")}
              aria-pressed={direction === "decrease"}
              className={
                "rounded-md border px-3 py-2 text-[13px] font-medium transition-colors " +
                (direction === "decrease"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              Decrease
            </button>
            <button
              type="button"
              onClick={() => setDirection("increase")}
              aria-pressed={direction === "increase"}
              className={
                "rounded-md border px-3 py-2 text-[13px] font-medium transition-colors " +
                (direction === "increase"
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              Increase
            </button>
          </div>
        </Field>

        <Field label="Quantity" required hint={selected ? `Unit: ${selected.unit}` : undefined}>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>

        <Field label="Transaction Type" required>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {["Waste", "Expired", "Damaged", "Manual Adjustment", "Purchase Receipt", "Return"].map(
              (t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              )
            )}
          </Select>
        </Field>

        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="Related PO">
          <Input value={relatedPo} onChange={(e) => setRelatedPo(e.target.value)} placeholder="e.g. PO-2026-001" />
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
