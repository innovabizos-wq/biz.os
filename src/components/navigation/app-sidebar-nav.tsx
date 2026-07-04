"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Brain,
  Boxes,
  CalendarDays,
  FileText,
  Home,
  MessageCircle,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

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

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isAnyItemActive(pathname: string, item: NavItem) {
  return isItemActive(pathname, item.href);
}

export function AppSidebarNav(props: AppSidebarNavProps) {
  const pathname = usePathname();
  const items = [
    {
      href: "/dashboard",
      icon: props.showReports ? BarChart3 : Home,
      label: props.showReports ? "Reportes" : "Inicio",
    },
    props.showCrm ? { href: "/crm/clientes", icon: Users, label: "CRM" } : null,
    props.showSales ? { href: "/ventas", icon: ShoppingCart, label: "Ventas" } : null,
    props.showQuotes ? { href: "/cotizaciones", icon: FileText, label: "Cotizaciones" } : null,
    props.showBilling ? { href: "/facturacion", icon: Receipt, label: "Facturacion" } : null,
    props.showCatalog ? { href: "/catalogo", icon: Boxes, label: "Catalogo" } : null,
    props.showInventory ? { href: "/inventario", icon: Boxes, label: "Inventario" } : null,
    props.showPurchases ? { href: "/compras", icon: ShoppingCart, label: "Compras" } : null,
    props.showPayments ? { href: "/pagos", icon: Receipt, label: "Pagos" } : null,
    props.showDispatch ? { href: "/despacho", icon: Boxes, label: "Despacho" } : null,
    props.showInbox ? { href: "/whapp/conversaciones", icon: MessageCircle, label: "Inbox" } : null,
    props.showAgenda ? { href: "/agenda", icon: CalendarDays, label: "Agenda" } : null,
    props.showAutoblog ? { href: "/autoblog", icon: FileText, label: "Autoblog" } : null,
    props.showBrain ? { href: "/brain", icon: Brain, label: "Brain" } : null,
    props.showHrDashboard
      ? { href: "/rrhh/planillas/dashboard", icon: BarChart3, label: "Planillas" }
      : null,
    props.showHr ? { href: "/rrhh/personal", icon: CalendarDays, label: "RRHH" } : null,
    props.showHrStates
      ? { href: "/rrhh/planillas/estados", icon: CalendarDays, label: "Estados" }
      : null,
    props.showAdmin ? { href: "/admin", icon: Settings, label: "Configuracion" } : null,
  ].filter(Boolean) as NavItem[];

  return (
    <nav aria-label="Navegacion principal" className="app-sidebar-nav">
      {items.map((item) => {
        const isActive = isAnyItemActive(pathname, item);
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
