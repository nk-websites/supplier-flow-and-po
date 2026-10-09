import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  ClipboardList,
  PackageSearch,
  Plus,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { cx, formatDate, formatINR, formatNumber, formatQty } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui/Misc";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/Feedback";

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.dashboard(), []);

  if (error) {
    return (
      <Card>
        <ErrorState message={error} onRetry={reload} />
      </Card>
    );
  }

  const k = data?.kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Stock health, vendor activity, and procurement at a glance."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/suppliers/new")}>
              <Plus className="h-4 w-4" />
              Add Supplier
            </Button>
            <Button onClick={() => navigate("/purchase-orders/new")}>
              <ShoppingCart className="h-4 w-4" />
              Raise Purchase Order
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {loading || !k
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-7 w-16" />
                <Skeleton className="mt-2 h-3 w-20" />
              </Card>
            ))
          : (
            <>
              <StatCard
                label="Total Suppliers"
                value={formatNumber(k.total_suppliers)}
                hint="Across all categories"
                icon={Truck}
                tone="primary"
              />
              <StatCard
                label="Low Stock"
                value={formatNumber(k.low_stock)}
                hint="At or below threshold"
                icon={AlertTriangle}
                tone="warning"
              />
              <StatCard
                label="Out Of Stock"
                value={formatNumber(k.out_of_stock)}
                hint="Needs immediate reorder"
                icon={PackageSearch}
                tone="danger"
              />
              <StatCard
                label="Open Purchase Orders"
                value={formatNumber(k.open_purchase_orders)}
                hint="Draft or sent to supplier"
                icon={ClipboardList}
                tone="info"
              />
              <StatCard
                label="Lifetime Spend"
                value={formatINR(k.lifetime_spend)}
                hint="Across completed & sent POs"
                icon={Banknote}
                tone="success"
              />
            </>
          )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent transactions"
            description="Latest inventory movements recorded by the team."
            actions={
              <Link
                to="/inventory/transactions"
                className="text-[13px] font-medium text-primary hover:underline"
              >
                View all
              </Link>
            }
          />
          {loading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : !data?.recent_transactions.length ? (
            <EmptyState
              title="No inventory movements yet"
              description="Record a waste, expiry, or adjustment to see it here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.recent_transactions.map((t) => {
                const negative = t.qty < 0;
                return (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span
                      className={cx(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        negative ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                      )}
                    >
                      {negative ? (
                        <ArrowDownRight className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {t.product_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.type} · {t.reason || "—"} · {t.created_by}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cx(
                          "text-[13px] font-semibold tabular-nums",
                          negative ? "text-destructive" : "text-success"
                        )}
                      >
                        {formatQty(t.qty)} {t.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Purchase orders needing attention"
              description="Drafts not yet sent to a supplier."
              actions={
                <Link
                  to="/purchase-orders"
                  className="text-[13px] font-medium text-primary hover:underline"
                >
                  Open
                </Link>
              }
            />
            {loading ? (
              <TableSkeleton rows={3} cols={2} />
            ) : !data?.purchase_orders_needing_attention.length ? (
              <EmptyState title="No open drafts" description="Everything has been sent." />
            ) : (
              <ul className="divide-y divide-border">
                {data.purchase_orders_needing_attention.slice(0, 5).map((po) => (
                  <li key={po.id}>
                    <Link
                      to={`/purchase-orders/new?draft=${po.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                          {po.reference}
                          <StatusBadge status={po.status} kind="po" />
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {po.supplier_name} · {po.item_count}{" "}
                          {po.item_count === 1 ? "item" : "items"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                        {formatINR(po.total)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-foreground">Quick actions</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <QuickAction to="/suppliers/new" icon={Plus} label="Add supplier" />
              <QuickAction to="/inventory/raw-materials/new" icon={PackageSearch} label="Add product" />
              <QuickAction to="/inventory/transactions" icon={ArrowLeftRight} label="Record movement" />
              <QuickAction to="/purchase-orders/new" icon={ShoppingCart} label="Raise PO" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Plus;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-[13px] font-medium text-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
    >
      <Icon className="h-4 w-4 text-primary" strokeWidth={1.9} />
      {label}
    </Link>
  );
}
