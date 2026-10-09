import { X } from "lucide-react";
import { cx } from "@/lib/format";

export function Chip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "primary";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        tone === "primary"
          ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
          : "bg-muted text-muted-foreground ring-1 ring-inset ring-border"
      )}
    >
      {label}
    </span>
  );
}

export function ChipGroup({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((c) => (
        <Chip key={c} label={c} />
      ))}
    </div>
  );
}

export function MultiSelectChips({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  columns?: number;
}) {
  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };
  return (
    <div
      className={cx(
        "grid gap-2",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-2 sm:grid-cols-3"
      )}
    >
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            type="button"
            key={opt}
            onClick={() => toggle(opt)}
            aria-pressed={active}
            className={cx(
              "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-[13px] transition-all",
              active
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "border-border bg-surface text-muted-foreground hover:border-input hover:text-foreground"
            )}
          >
            <span className="font-medium">{opt}</span>
            {active ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                ✓
              </span>
            ) : (
              <span className="h-4 w-4 rounded-full border border-input" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="rounded-full p-0.5 transition-colors hover:bg-primary/15"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
