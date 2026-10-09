import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GitMerge, Plus, ShoppingCart } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatINR } from "@/lib/format";
import { PageHeader, FilterPills } from "@/components/ui/Misc";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/Feedback";
import { Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, loading, error, reload } = useAsync(() => api.purchaseOrders.list(), []);
  const { data: suppliers } = useAsync(() => api.suppliers.list(), []);
  const [status, setStatus] = useState("All");
  const [supplierId, setSupplierId] = useState("All");
  const [merging, setMerging] = useState(false);

  const orders = data ?? [];

  const counts = useMemo(() => {
    const base: Record<string, number> = { All: orders.length, Draft: 0, Sent: 0, Completed: 0, Cancelled: 0 };
    orders.forEach((o) => {
      base[o.status] = (base[o.status] ?? 0) + 1;
    });
    return base;
  }, [orders]);

  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        if (status !== "All" && o.status !== status) return false;
        if (supplierId !== "All" && o.supplier_id !== supplierId) return false;
        return true;
      }),
    [orders, status, supplierId]
  );

  async function mergeDrafts() {
    setMerging(true);
    try {
      const res = await api.purchaseOrders.mergeDrafts();
      toast({
        title: res.count ? "Drafts merged" : "Nothing to merge",
        description: res.count
          ? `Combined drafts for ${res.count} supplier${res.count === 1 ? "" : "s"}.`
          : "Each supplier has at most one draft — nothing to combine.",
        tone: res.count ? "success" : "info",
      });
      if (res.count) reload();
    } catch (err) {
      toast({
        title: "Could not merge drafts",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Draft, send, and track orders across suppliers."
        actions={
          <>
            <Button variant="outline" onClick={mergeDrafts} loading={merging}>
              <GitMerge className="h-4 w-4" />
              Merge Drafts
            </Button>
            <Button onClick={() => navigate("/purchase-orders/new")}>
              <Plus className="h-4 w-4" />
              Raise New PO
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          value={status}
          onChange={setStatus}
          options={[
            { label: "Draft", value: "Draft", count: counts.Draft },
            { label: "Sent", value: "Sent", count: counts.Sent },
            { label: "Completed", value: "Completed", count: counts.Completed },
            { label: "Cancelled", value: "Cancelled", count: counts.Cancelled },
            { label: "All", value: "All", count: counts.All },
          ]}
        />
        <Select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="ml-auto w-52"
        >
          <option value="All">All suppliers</option>
          {(suppliers ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="h-5 w-5" />}
            title={orders.length === 0 ? "No purchase orders yet" : "No purchase orders match your filters"}
            description={
              orders.length === 0
                ? "Raise your first PO to start ordering from suppliers."
                : "Try a different status or supplier."
            }
            action={
              orders.length === 0 ? (
                <Button size="sm" onClick={() => navigate("/purchase-orders/new")}>
                  Raise New PO
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Draft ID / Reference</th>
                  <th>Supplier</th>
                  <th className="text-right">No. of Items</th>
                  <th className="text-right">Total Amount</th>
                  <th>Last Updated</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((po) => (
                  <tr key={po.id}>
                    <td>
                      <p className="font-medium text-foreground">{po.reference}</p>
                    </td>
                    <td className="text-muted-foreground">{po.supplier_name}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{po.item_count}</td>
                    <td className="text-right font-semibold tabular-nums">{formatINR(po.total)}</td>
                    <td className="text-muted-foreground">{formatDate(po.updated_at || po.activity_date)}</td>
                    <td>
                      <StatusBadge status={po.status} kind="po" />
                    </td>
                    <td className="text-right">
                      {po.status === "Draft" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/purchase-orders/new?draft=${po.id}`)}
                        >
                          Edit draft
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
  );
}
