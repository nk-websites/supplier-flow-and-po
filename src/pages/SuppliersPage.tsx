import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Download, Plus, Power, Upload } from "lucide-react";
import { api, ApiError, type SupplierInput } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { PageHeader, FilterPills, SearchInput } from "@/components/ui/Misc";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { ChipGroup } from "@/components/ui/Chip";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/Feedback";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { Supplier } from "@/types";

export function SuppliersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, loading, error, reload } = useAsync(() => api.suppliers.list(), []);
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const suppliers = data ?? [];

  const counts = useMemo(() => {
    return {
      All: suppliers.length,
      Active: suppliers.filter((s) => s.status === "Active").length,
      Inactive: suppliers.filter((s) => s.status === "Inactive").length,
    };
  }, [suppliers]);

  async function toggleStatus(s: Supplier) {
    const next = s.status === "Active" ? "Inactive" : "Active";
    setUpdatingId(s.id);
    try {
      await api.suppliers.setStatus(s.id, next);
      toast({
        title: next === "Active" ? "Supplier activated" : "Supplier deactivated",
        description: `${s.name} is now ${next.toLowerCase()}.`,
        tone: next === "Active" ? "success" : "info",
      });
      reload();
    } catch (err) {
      toast({
        title: "Could not update status",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => s.categories.forEach((c) => set.add(c.split(" / ")[0])));
    return ["All", ...Array.from(set).sort()];
  }, [suppliers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (status !== "All" && s.status !== status) return false;
      if (
        category !== "All" &&
        !s.categories.some((c) => c === category || c.startsWith(`${category} / `))
      )
        return false;
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
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={() => navigate("/suppliers/new")}>
              <Plus className="h-4 w-4" />
              Add New Supplier
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          value={status}
          onChange={setStatus}
          options={[
            { label: "All", value: "All", count: counts.All },
            { label: "Active", value: "Active", count: counts.Active },
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
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/suppliers/${s.id}`)}>
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={updatingId === s.id}
                          onClick={() => toggleStatus(s)}
                          className={s.status === "Active" ? "text-muted-foreground" : "text-success"}
                        >
                          <Power className="h-3.5 w-3.5" />
                          {s.status === "Active" ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {importOpen && (
        <ImportSuppliersDialog
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function csvRowToSupplier(header: string[], row: string[]): SupplierInput | null {
  const get = (names: string[]) => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx >= 0) return (row[idx] ?? "").trim();
    }
    return "";
  };
  const name = get(["name", "supplier name", "supplier"]);
  if (!name) return null;
  const contactName = get(["contact person", "contact", "contact name"]);
  const phone = get(["phone", "mobile"]);
  const email = get(["email", "e-mail"]);
  const hasContact = Boolean(contactName || phone || email);
  return {
    name,
    categories: get(["categories", "category", "categories supplied"])
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean),
    status: ((get(["status"]) || "Active") as Supplier["status"]),
    contact_person: contactName,
    phone,
    email,
    role: "",
    address: get(["address"]),
    city: get(["city"]),
    state: get(["state"]),
    country: get(["country"]) || "India",
    pincode: get(["pincode", "zip", "postal code"]),
    gst: get(["gst", "gstin", "tax id", "tax"]),
    payment_terms: get(["payment terms", "terms"]) || "Net 30",
    contacts: hasContact
      ? [{ name: contactName, phone, email, role: "", primary: true }]
      : [],
    products: [],
  };
}

function ImportSuppliersDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [suppliers, setSuppliers] = useState<SupplierInput[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ""));
      if (rows.length < 2) {
        setError("CSV must have a header row and at least one data row.");
        setSuppliers([]);
        return;
      }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const mapped = rows
        .slice(1)
        .map((r) => csvRowToSupplier(header, r))
        .filter((s): s is SupplierInput => s !== null);
      if (!mapped.length) {
        setError("No valid rows found. Each row needs a 'name' column.");
        setSuppliers([]);
        return;
      }
      setError("");
      setSuppliers(mapped);
      setFileName(file.name);
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const csv =
      "name,categories,contact_person,phone,email,address,city,state,country,pincode,gst,payment_terms,status\n" +
      "Fresh Farms Co.,Vegetables;Dairy,Ravi Kumar,+91 98765 43210,ravi@example.com,18 Residency Road,Bangalore,Karnataka,India,560025,29ABCDE1234F1Z5,Net 15,Active\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "suppliers-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doImport() {
    setImporting(true);
    try {
      const res = await api.suppliers.bulk(suppliers);
      toast({
        title: "Suppliers imported",
        description: `${res.created} supplier${res.created === 1 ? "" : "s"} onboarded.`,
        tone: "success",
      });
      onImported();
    } catch (err) {
      toast({
        title: "Could not import suppliers",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
      setImporting(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Import suppliers"
      description="Bulk onboard multiple suppliers from a CSV file."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={doImport} loading={importing} disabled={!suppliers.length}>
            Import {suppliers.length ? `(${suppliers.length})` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Choose CSV file
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            <Download className="h-3.5 w-3.5" />
            Download template
          </Button>
          {fileName && <span className="text-[13px] text-muted-foreground">{fileName}</span>}
        </div>

        <p className="text-[13px] text-muted-foreground">
          Columns: name, categories (separate with ; or |), contact_person, phone, email, address,
          city, state, country, pincode, gst, payment_terms, status.
        </p>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {suppliers.length > 0 && (
          <div className="max-h-72 overflow-auto rounded-md border border-border scrollbar-thin">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Categories</th>
                  <th>Contact</th>
                  <th>Country</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s, i) => (
                  <tr key={i}>
                    <td className="font-medium text-foreground">{s.name}</td>
                    <td className="text-muted-foreground">
                      {(s.categories ?? []).join(", ") || "—"}
                    </td>
                    <td className="text-muted-foreground">{s.contact_person || "—"}</td>
                    <td className="text-muted-foreground">{s.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>
  );
}
