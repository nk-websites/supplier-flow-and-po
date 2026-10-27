import { useMemo, useState } from "react";
import { Eye, Pencil, Plus, Send, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatINR } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { PurchaseOrder, Supplier } from "@/types";

interface DraftItem {
  product_id: string;
  name: string;
  unit: string;
  qty: string;
  unit_price: string;
}

function defaultSubject(po: PurchaseOrder): string {
  return `Purchase Order ${po.reference} — ${po.supplier_name}`;
}

export function SendSupplierEmailDialog({
  po,
  supplier,
  storeEmail,
  onClose,
  onSent,
}: {
  po: PurchaseOrder;
  supplier: Supplier | null;
  storeEmail: string;
  onClose: () => void;
  onSent: (updated: PurchaseOrder) => void;
}) {
  const { toast } = useToast();
  const contacts = (supplier?.contacts ?? []).filter((c) => c.email);
  const contactLabel = supplier?.contact_person || supplier?.name || "there";

  const [recipients, setRecipients] = useState<string[]>(() =>
    contacts.map((c) => c.email).filter(Boolean)
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [subject, setSubject] = useState(() => defaultSubject(po));
  const [intro, setIntro] = useState(
    `Dear ${contactLabel},\n\nPlease find our purchase order ${po.reference} below. Kindly confirm availability and the delivery date.`
  );
  const [closing, setClosing] = useState(
    `Please confirm delivery by ${formatDate(po.activity_date)}.\n\nThank you,\n${storeEmail}`
  );
  const [items, setItems] = useState<DraftItem[]>(() =>
    po.items.map((it) => ({
      product_id: it.product_id,
      name: it.product_name,
      unit: it.unit,
      qty: String(it.qty),
      unit_price: String(it.unit_price),
    }))
  );
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0),
    [items]
  );

  const toggleRecipient = (email: string) =>
    setRecipients((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );

  const addCustom = () => {
    const parts = custom
      .split(/[,\n;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) {
      setRecipients((prev) => Array.from(new Set([...prev, ...parts])));
      setCustom("");
    }
  };

  function composeBody(): string {
    const lines = items
      .map(
        (it) =>
          `  • ${it.name}: ${it.qty} ${it.unit} @ ${formatINR(Number(it.unit_price) || 0, {
            decimals: true,
          })} = ${formatINR((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}`
      )
      .join("\n");
    return [intro, "", "Items ordered:", lines, "", `Total: ${formatINR(total)}`, "", closing].join(
      "\n"
    );
  }

  async function send() {
    if (!recipients.length) {
      setError("Select at least one recipient email");
      return;
    }
    setError("");
    setSending(true);
    try {
      const changed =
        items.length !== po.items.length ||
        items.some((it, i) => {
          const o = po.items[i];
          return (
            !o ||
            Number(it.qty) !== o.qty ||
            Number(it.unit_price) !== o.unit_price ||
            it.product_id !== o.product_id
          );
        });
      if (changed) {
        await api.purchaseOrders.update(po.id, {
          supplier_id: po.supplier_id,
          status: po.status,
          activity_date: po.activity_date,
          items: items.map((it) => ({
            product_id: it.product_id,
            qty: Number(it.qty) || 0,
            unit: it.unit,
            unit_price: Number(it.unit_price) || 0,
          })),
        });
      }
      const updated = await api.purchaseOrders.sendEmail(po.id, {
        to: recipients,
        subject: subject.trim(),
        body: composeBody(),
      });
      toast({
        title: "Purchase order sent",
        description: `Emailed ${updated.reference} to ${recipients.length} recipient${
          recipients.length === 1 ? "" : "s"
        }.`,
      });
      onSent(updated);
    } catch (err) {
      toast({
        title: "Could not send email",
        description: err instanceof ApiError ? err.message : "Unexpected error",
        tone: "error",
      });
      setSending(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Send ${po.reference} to supplier`}
      description={
        mode === "preview"
          ? "Review the order and the message, then edit or send."
          : "Edit the recipients, message and line items before sending."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {mode === "preview" ? (
            <Button variant="outline" onClick={() => setMode("edit")}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setMode("preview")}>
              <Eye className="h-4 w-4" />
              Preview
            </Button>
          )}
          <Button onClick={send} loading={sending}>
            <Send className="h-4 w-4" />
            Send email
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <Field label="From">
          <Input value={storeEmail} disabled readOnly />
        </Field>

        <Field label="To" required hint="Pick a contact or type an address.">
          <div className="relative">
            <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-surface p-1.5 shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              {recipients.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[12px] text-foreground"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => toggleRecipient(email)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${email}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {recipients.length === 0 && (
                <span className="px-1.5 text-[13px] text-muted-foreground/70">
                  No recipients yet
                </span>
              )}
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                aria-label="Add recipient"
                aria-expanded={pickerOpen}
                className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {pickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-full rounded-md border border-border bg-surface p-1 shadow-pop">
                  <div className="max-h-56 overflow-auto scrollbar-thin">
                    {contacts.length === 0 ? (
                      <p className="px-2 py-1.5 text-[13px] text-muted-foreground">
                        No contact emails on file for this supplier.
                      </p>
                    ) : (
                      contacts.map((c) => (
                        <label
                          key={c.email}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/60"
                        >
                          <input
                            type="checkbox"
                            checked={recipients.includes(c.email)}
                            onChange={() => toggleRecipient(c.email)}
                            className="h-4 w-4 accent-[hsl(var(--primary))]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-foreground">
                              {c.name || "Unnamed contact"}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {c.role ? `${c.role} · ` : ""}
                              {c.email}
                            </span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1 border-t border-border px-1 pt-1">
                    <Input
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addCustom();
                        }
                      }}
                      onBlur={addCustom}
                      placeholder="Type an email…"
                      className="h-8"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </Field>

        {mode === "preview" ? (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-[13px] font-semibold text-foreground">{subject}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              To: {recipients.join(", ") || "—"}
            </p>
            <div className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
              {intro}
            </div>
            <table className="data-table mt-3">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.product_id}>
                    <td className="font-medium text-foreground">{it.name}</td>
                    <td className="text-right tabular-nums">
                      {it.qty} {it.unit}
                    </td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {formatINR(Number(it.unit_price) || 0, { decimals: true })}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatINR((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex justify-end border-t border-border pt-2 text-sm font-semibold text-foreground">
              Total:&nbsp;{formatINR(total)}
            </div>
            <div className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
              {closing}
            </div>
          </div>
        ) : (
          <>
            <Field label="Subject" required>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field label="Intro message">
              <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} />
            </Field>
            <div>
              <p className="field-label">Line items</p>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-right">Qty</th>
                      <th>Unit</th>
                      <th className="text-right">Unit Price</th>
                      <th className="text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={it.product_id}>
                        <td className="font-medium text-foreground">{it.name}</td>
                        <td className="w-24">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="text-right"
                            value={it.qty}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x))
                              )
                            }
                          />
                        </td>
                        <td className="text-muted-foreground">{it.unit}</td>
                        <td className="w-28">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="text-right"
                            value={it.unit_price}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x, j) =>
                                  j === i ? { ...x, unit_price: e.target.value } : x
                                )
                              )
                            }
                          />
                        </td>
                        <td className="text-right tabular-nums">
                          {formatINR((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex justify-end text-sm font-semibold text-foreground">
                Total:&nbsp;{formatINR(total)}
              </div>
            </div>
            <Field label="Closing message">
              <Textarea value={closing} onChange={(e) => setClosing(e.target.value)} />
            </Field>
          </>
        )}
      </div>
    </Dialog>
  );
}
