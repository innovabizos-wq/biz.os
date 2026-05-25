"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type AdminTabItem = {
  href: string;
  label: string;
};

type AdminTabsProps = {
  tabs: AdminTabItem[];
};

function isTabActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminTabs({ tabs }: AdminTabsProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones de administracion"
      className="overflow-x-auto rounded-2xl border border-[rgba(var(--kpi-theme-accent-rgb),0.24)] bg-white p-2 shadow-sm"
    >
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => {
          const isActive = isTabActive(pathname, tab.href);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                isActive &&
                  "app-theme-button text-white shadow-sm hover:text-white",
              )}
              href={tab.href}
              key={tab.href}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
