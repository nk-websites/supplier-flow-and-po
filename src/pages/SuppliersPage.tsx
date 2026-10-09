import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { PageHeader, FilterPills, SearchInput } from "@/components/ui/Misc";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { ChipGroup } from "@/components/ui/Chip";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/Feedback";
import { Select } from "@/components/ui/Input";

export function SuppliersPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.suppliers.list(), []);
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const suppliers = data ?? [];

  const counts = useMemo(() => {
    return {
      All: suppliers.length,
      Active: suppliers.filter((s) => s.status === "Active").length,
      Inactive: suppliers.filter((s) => s.status === "Inactive").length,
      "Pending Verification": suppliers.filter((s) => s.status === "Pending Verification").length,
    };
  }, [suppliers]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => s.categories.forEach((c) => set.add(c)));
    return ["All", ...Array.from(set).sort()];
  }, [suppliers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (status !== "All" && s.status !== status) return false;
      if (category !== "All" && !s.categories.includes(category)) return false;
      if (q && !`${s.name} ${s.contact_person} ${s.phone} ${s.email}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [suppliers, status, category, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Management"
        description="Vendors, negotiated categories, and payment terms."
        actions={
          <Button onClick={() => navigate("/suppliers/new")}>
            <Plus className="h-4 w-4" />
            Add New Supplier
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          value={status}
          onChange={setStatus}
          options={[
            { label: "All", value: "All", count: counts.All },
            { label: "Active", value: "Active", count: counts.Active },
            { label: "Inactive", value: "Inactive", count: counts.Inactive },
            { label: "Pending Verification", value: "Pending Verification", count: counts["Pending Verification"] },
          ]}
        />
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <SearchInput value={query} onChange={setQuery} placeholder="Search suppliers…" className="sm:w-56" />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All categories" : c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title={suppliers.length === 0 ? "No suppliers yet" : "No suppliers match your filters"}
            description={
              suppliers.length === 0
                ? "Add your first supplier to start raising purchase orders."
                : "Try changing the status, category, or search term."
            }
            action={
              suppliers.length === 0 ? (
                <Button onClick={() => navigate("/suppliers/new")}>
                  <Plus className="h-4 w-4" />
                  Add New Supplier
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>Category</th>
                  <th className="text-right">Items</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        to={`/suppliers/${s.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {s.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.code}</p>
                    </td>
                    <td className="text-muted-foreground">{s.contact_person || "—"}</td>
                    <td className="tabular-nums text-muted-foreground">{s.phone || "—"}</td>
                    <td>
                      <ChipGroup items={s.categories} />
                    </td>
                    <td className="text-right font-medium tabular-nums">{s.items_count}</td>
                    <td>
                      <StatusBadge status={s.status} kind="supplier" />
                    </td>
                    <td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/suppliers/${s.id}`)}>
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
    </div>
  );
}
