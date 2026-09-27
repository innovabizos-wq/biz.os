"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Brain,
  Boxes,
  CalendarDays,
  ChevronDown,
  FileText,
  Home,
  MessageCircle,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { useMemo } from "react";

type AppSidebarNavProps = {
  showCrm: boolean;
  showAgenda: boolean;
  showReports: boolean;
  showBrain: boolean;
  showQuotes: boolean;
  showSales: boolean;
  showCatalog: boolean;
  showInventory: boolean;
  showPayments: boolean;
  showPurchases: boolean;
  showDispatch: boolean;
  showHr: boolean;
  showHrDashboard: boolean;
  showHrStates: boolean;
  showInbox: boolean;
  showAutoblog: boolean;
  showBilling: boolean;
  showAdmin: boolean;
};

type NavItem = {
  href: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
};

type NavGroup = {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  id: string;
  items: NavItem[];
  label: string;
};

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isAnyItemActive(pathname: string, item: NavItem) {
  return isItemActive(pathname, item.href);
}

export function AppSidebarNav(props: AppSidebarNavProps) {
  const pathname = usePathname();
  const homeItem = {
    href: "/dashboard",
    icon: props.showReports ? BarChart3 : Home,
    label: props.showReports ? "Reportes" : "Inicio",
  };
  const groups = useMemo(
    () => [
      {
        icon: ShoppingCart,
        id: "commercial",
        items: [
          props.showCrm ? { href: "/crm/clientes", icon: Users, label: "CRM" } : null,
          props.showQuotes ? { href: "/cotizaciones", icon: FileText, label: "Cotizaciones" } : null,
          props.showSales ? { href: "/ventas", icon: ShoppingCart, label: "Ventas" } : null,
          props.showPayments ? { href: "/pagos", icon: Receipt, label: "Pagos" } : null,
        ].filter(Boolean) as NavItem[],
        label: "Comercial",
      },
      {
        icon: Boxes,
        id: "operations",
        items: [
          props.showCatalog ? { href: "/catalogo", icon: Boxes, label: "Catalogo" } : null,
          props.showInventory ? { href: "/inventario", icon: Boxes, label: "Inventario" } : null,
          props.showPurchases ? { href: "/compras", icon: ShoppingCart, label: "Compras" } : null,
          props.showDispatch ? { href: "/despacho", icon: Boxes, label: "Despacho" } : null,
        ].filter(Boolean) as NavItem[],
        label: "Operacion",
      },
      {
        icon: MessageCircle,
        id: "channels",
        items: [
          props.showInbox ? { href: "/whapp/conversaciones", icon: MessageCircle, label: "Inbox" } : null,
          props.showAgenda ? { href: "/agenda", icon: CalendarDays, label: "Agenda" } : null,
          props.showAutoblog ? { href: "/autoblog", icon: FileText, label: "Autoblog" } : null,
          props.showBrain ? { href: "/brain", icon: Brain, label: "Brain" } : null,
        ].filter(Boolean) as NavItem[],
        label: "Canales",
      },
      {
        icon: CalendarDays,
        id: "team",
        items: [
          props.showHrDashboard
            ? { href: "/rrhh/planillas/dashboard", icon: BarChart3, label: "Planillas" }
            : null,
          props.showHr ? { href: "/rrhh/personal", icon: CalendarDays, label: "RRHH" } : null,
          props.showHrStates
            ? { href: "/rrhh/planillas/estados", icon: CalendarDays, label: "Estados" }
            : null,
        ].filter(Boolean) as NavItem[],
        label: "Equipo",
      },
      {
        icon: Settings,
        id: "system",
        items: [
          props.showBilling ? { href: "/facturacion", icon: Receipt, label: "Facturacion" } : null,
          props.showAdmin ? { href: "/admin", icon: Settings, label: "Configuracion" } : null,
        ].filter(Boolean) as NavItem[],
        label: "Sistema",
      },
    ].filter((group) => group.items.length > 0) as NavGroup[],
    [props],
  );
  const activeGroupId = groups.find((group) =>
    group.items.some((item) => isAnyItemActive(pathname, item)),
  )?.id;
  const defaultOpenGroupId = activeGroupId ?? groups[0]?.id ?? null;
  const isHomeActive = isAnyItemActive(pathname, homeItem);
  const HomeIcon = homeItem.icon;

  return (
    <nav aria-label="Navegacion principal" className="app-sidebar-nav">
      <Link
        aria-current={isHomeActive ? "page" : undefined}
        className="app-sidebar-link app-sidebar-home-link"
        data-active={isHomeActive}
        href={homeItem.href}
      >
        <HomeIcon aria-hidden="true" size={22} strokeWidth={2.15} />
        <span>{homeItem.label}</span>
      </Link>

      <div className="app-sidebar-group-stack">
        {groups.map((group) => {
          const isOpen = defaultOpenGroupId === group.id;
          const isActive = activeGroupId === group.id;
          const Icon = group.icon;

          return (
            <details
              className="app-sidebar-group"
              data-active={isActive}
              key={group.id}
              name="app-sidebar-section"
              open={isOpen}
            >
              <summary
                className="app-sidebar-group-trigger"
              >
                <span className="app-sidebar-group-title">
                  <Icon aria-hidden="true" size={20} strokeWidth={2.2} />
                  <span>{group.label}</span>
                </span>
                <span className="app-sidebar-group-meta">
                  <ChevronDown aria-hidden="true" className="app-sidebar-toggle-icon" size={16} strokeWidth={2.2} />
                </span>
              </summary>

              <div className="app-sidebar-panel">
                <div className="app-sidebar-panel-inner">
                  {group.items.map((item) => {
                    const itemActive = isAnyItemActive(pathname, item);
                    const ItemIcon = item.icon;

                    return (
                      <Link
                        aria-current={itemActive ? "page" : undefined}
                        className="app-sidebar-link"
                        data-active={itemActive}
                        href={item.href}
                        key={item.href}
                      >
                        <ItemIcon aria-hidden="true" size={20} strokeWidth={2.1} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </nav>
  );
}
