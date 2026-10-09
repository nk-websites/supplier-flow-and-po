import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  success: "bg-success/10 text-success ring-1 ring-inset ring-success/20",
  warning: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/20",
  danger: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20",
  info: "bg-info/10 text-info ring-1 ring-inset ring-info/20",
  primary: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const supplierTone: Record<string, Tone> = {
  Active: "success",
  Inactive: "neutral",
  "Pending Verification": "warning",
};

const productTone: Record<string, Tone> = {
  "In Stock": "success",
  "Low Stock": "warning",
  "Out Of Stock": "danger",
};

const poTone: Record<string, Tone> = {
  Draft: "neutral",
  Sent: "info",
  Completed: "success",
  Cancelled: "danger",
};

const priorityTone: Record<string, Tone> = {
  P0: "danger",
  P1: "warning",
  P2: "neutral",
};

const txTone: Record<string, Tone> = {
  Waste: "warning",
  Expired: "danger",
  Damaged: "danger",
  "Manual Adjustment": "info",
  "Purchase Receipt": "success",
  Return: "primary",
};

export function StatusBadge({ status, kind }: { status: string; kind: "supplier" | "product" | "po" }) {
  const map = kind === "supplier" ? supplierTone : kind === "product" ? productTone : poTone;
  return <Badge tone={map[status] ?? "neutral"}>{status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={priorityTone[priority] ?? "neutral"}>{priority}</Badge>;
}

export function TransactionTypeBadge({ type }: { type: string }) {
  return <Badge tone={txTone[type] ?? "neutral"}>{type}</Badge>;
}
