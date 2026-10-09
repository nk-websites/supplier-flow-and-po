import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { api, ApiError, type SupplierInput } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { cx } from "@/lib/format";
import { PageHeader } from "@/components/ui/Misc";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { MultiSelectChips } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";

interface ContactDraft {
  key: string;
  name: string;
  phone: string;
  email: string;
  role: string;
}

interface ProductDraft {
  key: string;
  name: string;
  price: string;
  unit: string;
  priority: string;
  moq: string;
}

let seq = 0;
const nextKey = () => `k${++seq}`;

export function SupplierNewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: meta } = useAsync(() => api.meta(), []);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [status, setStatus] = useState("Active");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [country, setCountry] = useState("India");
  const [pincode, setPincode] = useState("");
  const [gst, setGst] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [contacts, setContacts] = useState<ContactDraft[]>([
    { key: nextKey(), name: "", phone: "", email: "", role: "" },
  ]);
  const [products, setProducts] = useState<ProductDraft[]>([]);

  const categoriesList = meta?.categories ?? [
    "Vegetables",
    "Dairy",
    "Meat",
    "Grains",
    "Spices",
    "Packaging",
    "Other",
  ];
  const countries = meta?.countries ?? ["India"];
  const terms = meta?.payment_terms ?? ["Net 7", "Net 15", "Net 30", "COD"];
  const units = meta?.units ?? ["kg", "litre", "piece", "dozen", "pack", "gram"];

  const updateContact = (key: string, patch: Partial<ContactDraft>) =>
    setContacts((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const addContact = () =>
    setContacts((prev) => [...prev, { key: nextKey(), name: "", phone: "", email: "", role: "" }]);

  const removeContact = (key: string) =>
    setContacts((prev) => (prev.length > 1 ? prev.filter((c) => c.key !== key) : prev));

  const addProduct = () =>
    setProducts((prev) => [
      ...prev,
      { key: nextKey(), name: "", price: "", unit: units[0] ?? "kg", priority: "P1", moq: "" },
    ]);

  const updateProduct = (key: string, patch: Partial<ProductDraft>) =>
    setProducts((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const removeProduct = (key: string) => setProducts((prev) => prev.filter((p) => p.key !== key));

  function validateStep1(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Supplier name is required";
    if (!categories.length) e.categories = "Select at least one category";
    if (!address.trim()) e.address = "Address is required";
    if (!city.trim()) e.city = "City is required";
    if (!stateName.trim()) e.state = "State is required";
    if (!country.trim()) e.country = "Country is required";
    if (!contacts[0]?.name.trim()) e.contactName = "Primary contact name is required";
    if (!contacts[0]?.phone.trim()) e.contactPhone = "Primary contact phone is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    const payload: SupplierInput = {
      name: name.trim(),
      categories,
      status,
      address: address.trim(),
      city: city.trim(),
      state: stateName.trim(),
      country: country.trim(),
      pincode: pincode.trim(),
      gst: gst.trim(),
      payment_terms: paymentTerms,
      role: contacts[0]?.role ?? "",
      email: contacts[0]?.email ?? "",
      contacts: contacts
        .filter((c) => c.name.trim() || c.phone.trim())
        .map((c, i) => ({
          name: c.name.trim(),
          phone: c.phone.trim(),
          email: c.email.trim(),
          role: c.role.trim(),
          primary: i === 0,
        })),
      products: products
        .filter((p) => p.name.trim())
        .map((p) => ({
          name: p.name.trim(),
          price: Number(p.price) || 0,
          unit: p.unit,
          priority: p.priority,
          moq: Number(p.moq) || 0,
        })),
    };

    setSaving(true);
    try {
      const created = await api.suppliers.create(payload);
      toast({ title: "Supplier created", description: `${created.name} was added successfully.` });
      navigate(`/suppliers/${created.id}`);
    } catch (err) {
      toast({
        title: "Could not create supplier",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/suppliers")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to suppliers
      </button>

      <PageHeader title="Add Supplier" description="Register a vendor and the products they supply." />

      <Stepper step={step} />

      {step === 1 ? (
        <>
          <Card>
            <CardHeader title="Business details" description="Legal name and the categories this vendor supplies." />
            <CardBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Supplier Name" required error={errors.name} htmlFor="supplier-name">
                  <Input
                    id="supplier-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Fresh Farms Co."
                  />
                </Field>
                <Field label="Status">
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {(meta?.supplier_statuses ?? ["Active", "Inactive", "Pending Verification"]).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Categories Supplied" required error={errors.categories}>
                <MultiSelectChips options={categoriesList} value={categories} onChange={setCategories} columns={3} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Address" description="Where the vendor operates or ships from." />
            <CardBody className="space-y-4">
              <Field label="Address" required error={errors.address} htmlFor="address">
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, building, area"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="City" required error={errors.city}>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
                </Field>
                <Field label="State" required error={errors.state}>
                  <Input value={stateName} onChange={(e) => setStateName(e.target.value)} placeholder="State" />
                </Field>
                <Field label="Country" required error={errors.country}>
                  <Select value={country} onChange={(e) => setCountry(e.target.value)}>
                    {countries.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Pincode">
                  <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="560001" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="GST / Tax ID">
                  <Input value={gst} onChange={(e) => setGst(e.target.value)} placeholder="29ABCDE1234F1Z5" />
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Contact persons"
              description="The first contact is treated as the primary contact."
              actions={
                <Button variant="outline" size="sm" onClick={addContact}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Another Contact
                </Button>
              }
            />
            <CardBody className="space-y-4">
              {contacts.map((contact, index) => (
                <div key={contact.key} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-foreground">
                      Contact {index + 1}
                      {index === 0 && (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          Primary
                        </span>
                      )}
                    </span>
                    {index > 0 && (
                      <button
                        onClick={() => removeContact(contact.key)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove contact ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Contact Name"
                      required={index === 0}
                      error={index === 0 ? errors.contactName : undefined}
                    >
                      <Input
                        value={contact.name}
                        onChange={(e) => updateContact(contact.key, { name: e.target.value })}
                        placeholder="Full name"
                      />
                    </Field>
                    <Field
                      label="Phone"
                      required={index === 0}
                      error={index === 0 ? errors.contactPhone : undefined}
                    >
                      <Input
                        value={contact.phone}
                        onChange={(e) => updateContact(contact.key, { phone: e.target.value })}
                        placeholder="+91 98765 43210"
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={contact.email}
                        onChange={(e) => updateContact(contact.key, { email: e.target.value })}
                        placeholder="name@company.com"
                      />
                    </Field>
                    <Field label="Role / Designation">
                      <Input
                        value={contact.role}
                        onChange={(e) => updateContact(contact.key, { role: e.target.value })}
                        placeholder="e.g. Sales Manager"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payment" description="Agreed settlement terms for purchases." />
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Payment Terms" required>
                  <Select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
                    {terms.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </CardBody>
            <CardFooter className="justify-end">
              <Button variant="outline" onClick={() => navigate("/suppliers")}>
                Cancel
              </Button>
              <Button onClick={() => validateStep1() && setStep(2)}>Continue to products</Button>
            </CardFooter>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader
            title="Products supplied"
            description="Negotiated prices and order priorities for this vendor."
            actions={
              <Button variant="outline" size="sm" onClick={addProduct}>
                <Plus className="h-3.5 w-3.5" />
                Add product
              </Button>
            }
          />
          <CardBody className="space-y-4">
            {products.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
                <p className="text-[13px] text-muted-foreground">
                  No products added yet. You can add them now or later from the supplier page.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={addProduct}>
                  <Plus className="h-3.5 w-3.5" />
                  Add product
                </Button>
              </div>
            ) : (
              products.map((p, index) => (
                <div
                  key={p.key}
                  className="grid items-end gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.8fr_auto]"
                >
                  <Field label={`Product ${index + 1}`}>
                    <Input
                      value={p.name}
                      onChange={(e) => updateProduct(p.key, { name: e.target.value })}
                      placeholder="Product name or SKU"
                    />
                  </Field>
                  <Field label="Price (₹)">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={p.price}
                      onChange={(e) => updateProduct(p.key, { price: e.target.value })}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label="Per Unit">
                    <Select value={p.unit} onChange={(e) => updateProduct(p.key, { unit: e.target.value })}>
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Priority">
                    <Select value={p.priority} onChange={(e) => updateProduct(p.key, { priority: e.target.value })}>
                      {["P0", "P1", "P2"].map((pr) => (
                        <option key={pr} value={pr}>
                          {pr}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="MOQ">
                    <Input
                      type="number"
                      min="0"
                      value={p.moq}
                      onChange={(e) => updateProduct(p.key, { moq: e.target.value })}
                      placeholder="0"
                    />
                  </Field>
                  <button
                    onClick={() => removeProduct(p.key)}
                    className="mb-0.5 rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove product ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </CardBody>
          <CardFooter>
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save supplier
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ["Supplier details", "Products supplied"];
  return (
    <div className="flex items-center gap-3">
      {steps.map((label, index) => {
        const n = index + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors",
                  active && "border-primary bg-primary text-primary-foreground",
                  done && "border-primary/30 bg-primary/10 text-primary",
                  !active && !done && "border-border bg-surface text-muted-foreground"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span
                className={cx(
                  "text-[13px] font-medium",
                  active || done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 && <span className="h-px w-8 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
