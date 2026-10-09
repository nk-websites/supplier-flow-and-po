import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, ApiError, type ProductInput } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { PageHeader } from "@/components/ui/Misc";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export function ProductNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: meta } = useAsync(() => api.meta(), []);
  const { data: suppliers } = useAsync(() => api.suppliers.list(), []);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("Vegetables");
  const [unit, setUnit] = useState("kg");
  const [current, setCurrent] = useState("0");
  const [threshold, setThreshold] = useState("0");
  const [cost, setCost] = useState("0");
  const [costType, setCostType] = useState("Last Purchase Price");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const categories = meta?.categories ?? ["Vegetables", "Dairy", "Meat", "Grains", "Spices", "Packaging", "Other"];
  const units = meta?.units ?? ["kg", "litre", "piece", "dozen", "pack", "gram"];

  async function save() {
    if (!name.trim()) {
      setError("Product name is required");
      return;
    }
    setError("");
    const payload: ProductInput = {
      name: name.trim(),
      sku: sku.trim(),
      category,
      unit,
      current: Number(current) || 0,
      threshold: Number(threshold) || 0,
      cost: Number(cost) || 0,
      cost_type: costType,
      preferred_supplier_id: supplierId || null,
      notes: notes.trim(),
    };
    setSaving(true);
    try {
      const created = await api.products.create(payload);
      toast({ title: "Product created", description: `${created.name} was added to inventory.` });
      navigate(`/inventory/raw-materials/${created.id}`);
    } catch (err) {
      toast({
        title: "Could not create product",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/inventory/products")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to products
      </button>

      <PageHeader title="Add Product" description="Create a raw material and set its reorder rules." />

      <Card>
        <CardHeader title="Product details" description="Identity, stock, and costing information." />
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product Name" required error={error}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tomatoes" />
            </Field>
            <Field label="SKU Code" hint="Optional short code, e.g. VEG-TOM">
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="VEG-TOM" />
            </Field>
            <Field label="Category" required>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unit" required>
              <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Current Stock" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
            <Field label="Reorder Threshold" required hint="Alerts below this level">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </Field>
            <Field label="Cost">
              <Input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cost Type">
              <Select value={costType} onChange={(e) => setCostType(e.target.value)}>
                <option value="Last Purchase Price">Last Purchase Price</option>
                <option value="Average Cost">Average Cost</option>
              </Select>
            </Field>
            <Field label="Preferred Supplier">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">No preferred supplier</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Storage notes, handling instructions, etc."
              className="min-h-[80px] w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>
        </CardBody>
        <CardFooter className="justify-end">
          <Button variant="outline" onClick={() => navigate("/inventory/products")}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save product
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
