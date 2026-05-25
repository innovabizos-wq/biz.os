"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";

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
  showAdmin: boolean;
};

type NavItem = {
  href: string;
  label: string;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupHasActiveItem(pathname: string, group: NavGroup) {
  return group.items.some((item) => isItemActive(pathname, item.href));
}

function buildInitialOpenState(pathname: string, groups: NavGroup[]) {
  return groups.reduce<Record<string, boolean>>((state, group) => {
    state[group.id] = groupHasActiveItem(pathname, group) || group.id === "inicio";
    return state;
  }, {});
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
  showAdmin,
}: AppSidebarNavProps) {
  const pathname = usePathname();
  const groups: NavGroup[] = [
    {
      id: "inicio",
      label: "Inicio",
      items: [{ href: "/dashboard", label: "Dashboard" }],
    },
    {
      id: "comercial",
      label: "Comercial",
      items: [
        showCrm ? { href: "/crm/clientes", label: "Clientes" } : null,
        showAgenda ? { href: "/agenda", label: "Agenda" } : null,
        showQuotes ? { href: "/cotizaciones", label: "Cotizaciones" } : null,
        showSales ? { href: "/ventas", label: "Ventas" } : null,
        showCatalog ? { href: "/catalogo", label: "Catalogo" } : null,
      ].filter(Boolean) as NavItem[],
    },
    {
      id: "comunicacion",
      label: "Comunicacion",
      items: [showInbox ? { href: "/inbox", label: "Inbox" } : null].filter(
        Boolean,
      ) as NavItem[],
    },
    {
      id: "operacion",
      label: "Operacion",
      items: [
        showInventory ? { href: "/inventario", label: "Inventario" } : null,
        showDispatch ? { href: "/despacho", label: "Despacho" } : null,
      ].filter(Boolean) as NavItem[],
    },
    {
      id: "rrhh",
      label: "RRHH",
      items: [
        showHr ? { href: "/rrhh/planillas", label: "Planillas" } : null,
        showHrDashboard
          ? { href: "/rrhh/planillas/dashboard", label: "Dashboard operativo" }
          : null,
        showHrStates
          ? { href: "/rrhh/planillas/estados", label: "Estados de planilla" }
          : null,
      ].filter(Boolean) as NavItem[],
    },
    {
      id: "administracion",
      label: "Administracion",
      items: showAdmin ? [{ href: "/admin", label: "Administracion" }] : [],
    },
  ].filter((group) => {
    if (group.id === "administracion" && !showAdmin) return false;
    return group.items.length > 0;
  });
  const [openGroups, setOpenGroups] = useState(() =>
    buildInitialOpenState(pathname, groups),
  );

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  }

  return (
    <nav aria-label="Navegacion principal" className="app-sidebar-nav">
      {groups.map((group) => {
        const isOpen = openGroups[group.id] ?? false;
        const hasActiveItem = groupHasActiveItem(pathname, group);
        const Icon = isOpen ? Minus : Plus;

        return (
          <section
            className="app-sidebar-group"
            data-active={hasActiveItem}
            key={group.id}
          >
            <button
              aria-expanded={isOpen}
              className="app-sidebar-group-trigger"
              onClick={() => toggleGroup(group.id)}
              type="button"
            >
              <span>{group.label}</span>
              <span className="app-sidebar-toggle-icon" aria-hidden="true">
                <Icon size={14} strokeWidth={2.3} />
              </span>
            </button>

            <div className="app-sidebar-panel" data-open={isOpen}>
              <div className="app-sidebar-panel-inner">
                {group.items.map((item) => {
                  const isActive = isItemActive(pathname, item.href);

                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className="app-sidebar-link"
                      data-active={isActive}
                      href={item.href}
                      key={item.href}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </nav>
  );
}
