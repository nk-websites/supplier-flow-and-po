import { NavLink } from "react-router-dom";
import {
  ArrowLeftRight,
  ClipboardList,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { cx } from "@/lib/format";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const mainNav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
];

const inventoryNav: NavItem[] = [
  { to: "/inventory/products", label: "Products", icon: Package },
  { to: "/inventory/transactions", label: "Transactions", icon: ArrowLeftRight },
];

const procurementNav: NavItem[] = [
  { to: "/purchase-requests", label: "Purchase Requests", icon: ClipboardList },
  { to: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
];

function NavEntry({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cx(
          "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-sidebar-accent text-white"
            : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
          )}
          <Icon
            className={cx(
              "h-4 w-4 shrink-0 transition-colors",
              isActive ? "text-primary" : "text-sidebar-muted group-hover:text-white"
            )}
            strokeWidth={1.9}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

function NavSection({
  label,
  items,
  collapsed,
}: {
  label: string;
  items: NavItem[];
  collapsed: boolean;
}) {
  return (
    <div className="space-y-1">
      {!collapsed && (
        <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
          {label}
        </p>
      )}
      {collapsed && <div className="mx-2 my-2 border-t border-sidebar-border" />}
      {items.map((item) => (
        <NavEntry key={item.to} item={item} collapsed={collapsed} />
      ))}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className={cx("flex h-14 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            N
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-none text-white">NewKommerce</p>
              <p className="mt-1 truncate text-[11px] leading-none text-sidebar-muted">Procurement</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className={cx(
            "hidden rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-white lg:block",
            collapsed && "hidden"
          )}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          className="mx-auto mt-2 hidden rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-white lg:block"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3 scrollbar-thin">
        <NavSection label="Overview" items={mainNav} collapsed={collapsed} />
        <NavSection label="Inventory" items={inventoryNav} collapsed={collapsed} />
        <NavSection label="Procurement" items={procurementNav} collapsed={collapsed} />
      </nav>

      {!collapsed && (
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-md bg-sidebar-accent/50 px-2.5 py-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-accent text-[11px] font-semibold text-white">
              AM
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium leading-none text-white">Aarav Mehta</p>
              <p className="mt-1 truncate text-[11px] leading-none text-sidebar-muted">Store Manager</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
