import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Package, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatINR } from "@/lib/format";
import { PageHeader, FilterPills, SearchInput } from "@/components/ui/Misc";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/Feedback";
import { Select } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import type { SuggestedPurchase } from "@/types";

export function ProductsPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.products.list(), []);
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [unit, setUnit] = useState("All");
  const [query, setQuery] = useState("");
  const [showSuggested, setShowSuggested] = useState(false);

  const products = data ?? [];

  const alertCount = products.filter(
    (p) => p.status === "Low Stock" || p.status === "Out Of Stock"
  ).length;

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category))).sort()],
    [products]
  );
  const units = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.unit))).sort()],
    [products]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (status !== "All" && p.status !== status) return false;
      if (category !== "All" && p.category !== category) return false;
      if (unit !== "All" && p.unit !== unit) return false;
      if (q && !`${p.name} ${p.sku} ${p.code}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, status, category, unit, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Raw materials, stock levels, and cost basis."
        actions={
          <Button onClick={() => navigate("/inventory/raw-materials/new")}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        }
      />

      {alertCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning/[0.07] px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <p className="flex-1 text-[13px] text-foreground">
            <span className="font-semibold">{alertCount}</span>{" "}
            {alertCount === 1 ? "product is" : "products are"} at or below their reorder threshold.
          </p>
          <button
            onClick={() => setShowSuggested(true)}
            className="text-[13px] font-medium text-primary hover:underline"
          >
            View suggested purchases
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          value={status}
          onChange={setStatus}
          options={[
            { label: "All", value: "All", count: products.length },
            { label: "Low Stock", value: "Low Stock", count: products.filter((p) => p.status === "Low Stock").length },
            { label: "Out Of Stock", value: "Out Of Stock", count: products.filter((p) => p.status === "Out Of Stock").length },
          ]}
        />
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <SearchInput value={query} onChange={setQuery} placeholder="Search products…" className="sm:w-52" />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-36">
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All categories" : c}
              </option>
            ))}
          </Select>
          <Select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-32">
            {units.map((u) => (
              <option key={u} value={u}>
                {u === "All" ? "All units" : u}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Package className="h-5 w-5" />}
            title={products.length === 0 ? "No products yet" : "No products match your filters"}
            description={
              products.length === 0
                ? "Add your first raw material to start tracking stock."
                : "Try a different status, category, unit, or search term."
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="text-right">Current</th>
                  <th className="text-right">Threshold</th>
                  <th className="text-right">Cost / Unit</th>
                  <th>Preferred Supplier</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{p.sku || p.code}</p>
                    </td>
                    <td className="text-muted-foreground">{p.category}</td>
                    <td className="text-right font-medium tabular-nums">
                      {p.current} <span className="text-xs font-normal text-muted-foreground">{p.unit}</span>
                    </td>
                    <td className="text-right tabular-nums text-muted-foreground">{p.threshold}</td>
                    <td className="text-right">
                      <p className="font-medium tabular-nums">{formatINR(p.cost, { decimals: true })}</p>
                      <p className="text-xs text-muted-foreground">{p.cost_type}</p>
                    </td>
                    <td className="text-muted-foreground">{p.preferred_supplier_name || "—"}</td>
                    <td>
                      <StatusBadge status={p.status} kind="product" />
                    </td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/inventory/raw-materials/${p.id}`)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SuggestedDialog open={showSuggested} onClose={() => setShowSuggested(false)} />
    </div>
  );
}

function SuggestedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, loading, error, reload } = useAsync(
    () => (open ? api.products.suggested() : Promise.resolve([] as SuggestedPurchase[])),
    [open]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Suggested purchases"
      description="Products at or below threshold, with a suggested reorder quantity."
    >
      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState title="Nothing to reorder" description="All products are above their threshold." />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-right">On hand</th>
              <th className="text-right">Threshold</th>
              <th className="text-right">Suggested</th>
              <th className="text-right">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id}>
                <td>
                  <p className="font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.preferred_supplier_name || "No supplier"}</p>
                </td>
                <td className="text-right tabular-nums">
                  {p.current} {p.unit}
                </td>
                <td className="text-right tabular-nums text-muted-foreground">{p.threshold}</td>
                <td className="text-right tabular-nums font-medium">
                  {p.suggested_qty} {p.unit}
                </td>
                <td className="text-right tabular-nums">{formatINR(p.estimated_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Dialog>
  );
}
