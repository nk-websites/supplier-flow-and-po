import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cx } from "@/lib/format";
import type { CategoryNode } from "@/types";

const SEP = " / ";

function join(path: string, name: string): string {
  return path ? `${path}${SEP}${name}` : name;
}

export function CategoryTreePicker({
  tree,
  value,
  onChange,
}: {
  tree: CategoryNode[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleSelect = (path: string) =>
    onChange(value.includes(path) ? value.filter((v) => v !== path) : [...value, path]);

  const toggleExpand = (path: string) =>
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));

  const renderNode = (node: CategoryNode, path: string, depth: number) => {
    const full = join(path, node.name);
    const hasChildren = Boolean(node.children && node.children.length);
    const selected = value.includes(full);
    const open = expanded[full];

    return (
      <div key={full}>
        <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(full)}
              aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
              aria-expanded={open}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className={cx("h-4 w-4 transition-transform", open && "rotate-90")} />
            </button>
          ) : (
            <span className="inline-block h-5 w-5 shrink-0" aria-hidden />
          )}
          <button
            type="button"
            onClick={() => toggleSelect(full)}
            aria-pressed={selected}
            className={cx(
              "flex flex-1 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-[13px] font-medium transition-colors",
              selected
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface text-foreground hover:border-input hover:bg-muted/50"
            )}
          >
            <span className="truncate">{node.name}</span>
            <span
              className={cx(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                selected ? "border-primary bg-primary" : "border-input"
              )}
            >
              {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
            </span>
          </button>
        </div>
        {hasChildren && open && (
          <div className="mt-1 space-y-1">
            {node.children!.map((child) => renderNode(child, full, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return <div className="space-y-1">{tree.map((node) => renderNode(node, "", 0))}</div>;
}
