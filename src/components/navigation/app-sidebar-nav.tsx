"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  FileText,
  Home,
  MessageCircle,
  Newspaper,
  PackageCheck,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";

type AppSidebarNavProps = {
  showCrm: boolean;
  showAgenda: boolean;
  showQuotes: boolean;
  showSales: boolean;
  showCatalog: boolean;
  showInventory: boolean;
  showDispatch: boolean;
  showHr: boolean;
  showHrDashboard: boolean;
  showHrStates: boolean;
  showInbox: boolean;
  showAutoblog: boolean;
  showAdmin: boolean;
};

type NavItem = {
  href: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
};

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebarNav({
  showCrm,
  showAgenda,
  showQuotes,
  showSales,
  showCatalog,
  showInventory,
  showDispatch,
  showHr,
  showHrDashboard,
  showHrStates,
  showInbox,
  showAutoblog,
  showAdmin,
}: AppSidebarNavProps) {
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", icon: Home, label: "Inicio" },
    showCrm ? { href: "/crm/clientes", icon: Users, label: "CRM" } : null,
    showSales ? { href: "/ventas", icon: ShoppingCart, label: "Ventas" } : null,
    showQuotes ? { href: "/cotizaciones", icon: FileText, label: "Cotizaciones" } : null,
    showCatalog ? { href: "/catalogo", icon: PackageCheck, label: "Catalogo" } : null,
    showInventory ? { href: "/inventario", icon: Boxes, label: "Inventario" } : null,
    showDispatch ? { href: "/despacho", icon: Truck, label: "Despacho" } : null,
    showAgenda ? { href: "/agenda", icon: CalendarDays, label: "Agenda" } : null,
    showAutoblog ? { href: "/autoblog", icon: Newspaper, label: "Autoblog" } : null,
    showInbox ? { href: "/whapp/conversaciones", icon: MessageCircle, label: "Inbox" } : null,
    showHrDashboard
      ? { href: "/rrhh/planillas/dashboard", icon: BarChart3, label: "Reportes" }
      : null,
    showHr ? { href: "/rrhh/personal", icon: Zap, label: "RRHH" } : null,
    showHrStates
      ? { href: "/rrhh/planillas/estados", icon: CalendarDays, label: "Estados" }
      : null,
    showAdmin ? { href: "/admin", icon: Settings, label: "Configuracion" } : null,
  ].filter(Boolean) as NavItem[];

  return (
    <nav aria-label="Navegacion principal" className="app-sidebar-nav">
      {items.map((item) => {
        const isActive = isItemActive(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className="app-sidebar-link"
            data-active={isActive}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" size={23} strokeWidth={2.15} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
