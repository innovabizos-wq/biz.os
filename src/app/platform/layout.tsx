import Link from "next/link";
import type { ReactNode } from "react";
import {
  Building2,
  Headset,
  HeartPulse,
  LayoutDashboard,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { PLATFORM_NAV_ITEMS, PLATFORM_ROLE_LABELS } from "@/modules/platform-console/constants";
import { requirePlatformAccess } from "@/modules/platform-console/guards";

const platformNavIcons = {
  "/platform": LayoutDashboard,
  "/platform/empresas": Building2,
  "/platform/health": HeartPulse,
  "/platform/soporte": Headset,
  "/platform/whapp": Smartphone,
} as const;

type PlatformNavHref = keyof typeof platformNavIcons;

export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  const platformUser = await requirePlatformAccess();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-slate-50 text-slate-900">
      <header className="border-b border-blue-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-300">
              <ShieldCheck className="size-6" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
                Platform Console
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">
                Operacion interna de biz.os / AInovaCR
              </h1>
            </div>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <span className="block font-bold">{platformUser.name}</span>
            <span className="text-xs text-blue-700">
              {PLATFORM_ROLE_LABELS[platformUser.role]}
            </span>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl flex-wrap gap-2 px-6 pb-5">
          {PLATFORM_NAV_ITEMS.map((item) => (
            <PlatformNavLink
              href={item.href as PlatformNavHref}
              key={item.href}
              label={item.label}
            />
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

function PlatformNavLink({
  href,
  label,
}: {
  href: PlatformNavHref;
  label: string;
}) {
  const Icon = platformNavIcons[href];

  return (
    <Link
      className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
      href={href}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

