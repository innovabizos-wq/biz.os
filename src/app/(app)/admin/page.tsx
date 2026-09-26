import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Building2,
  Cable,
  ChevronRight,
  Palette,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { InfoCard } from "@/components/shared/info-card";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { getAdminCoreSnapshot } from "@/modules/tenant/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type SettingsLink = {
  href: string;
  label: string;
};

type SettingsGroup = {
  description: string;
  icon: LucideIcon;
  links: SettingsLink[];
  title: string;
};

function SettingsGroupCard({ group }: { group: SettingsGroup }) {
  const Icon = group.icon;

  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
          <Icon aria-hidden="true" size={20} />
        </span>
        <div>
          <h2 className="font-bold text-slate-950">{group.title}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">{group.description}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {group.links.map((link) => (
          <Link
            className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            href={link.href}
            key={link.href}
          >
            {link.label}
            <ChevronRight aria-hidden="true" size={16} />
          </Link>
        ))}
      </div>
    </article>
  );
}

export default async function AdminPage() {
  const access = await requireAdminAccess();
  const snapshot = await getAdminCoreSnapshot(access.tenant, access.profile);

  if (!snapshot.ok) {
    return (
      <EmptyState
        description={snapshot.error.message}
        title="No se pudo cargar la administración"
      />
    );
  }

  const data = snapshot.data;
  const permissions = access.tenant.permissions;
  const canViewSettings = hasAnyPermission(permissions, ["admin.settings.view", "admin.settings.manage"]);
  const canManageSettings = hasPermission(permissions, "admin.settings.manage");
  const canViewUsers = hasAnyPermission(permissions, ["admin.users.view", "admin.users.manage"]);
  const canViewRoles = hasAnyPermission(permissions, ["admin.roles.view", "admin.roles.manage"]);
  const canViewFiscal = isModuleActive(access.tenant.activeModules, "billing") && hasAnyPermission(permissions, [
    "admin.settings.view",
    "admin.settings.manage",
    "billing.fiscal.view",
    "billing.fiscal.manage",
  ]);
  const canViewAi = isModuleActive(access.tenant.activeModules, "ai") && hasAnyPermission(permissions, [
    "admin.settings.manage",
    "ai.reports.use",
  ]);
  const groups: SettingsGroup[] = [
    canViewSettings ? {
      description: "Datos de tu negocio, plan y funciones que deseas tener disponibles.",
      icon: Building2,
      links: [
        { href: "/admin/empresa", label: "Datos de empresa" },
        { href: "/admin/plan", label: "Plan y límites" },
        ...(canManageSettings ? [{ href: "/admin/modulos", label: "Módulos activos" }] : []),
      ],
      title: "Tu empresa",
    } : null,
    canViewUsers || canViewRoles ? {
      description: "Personas que usan Biz.OS y el nivel de acceso que tiene cada una.",
      icon: UsersRound,
      links: [
        ...(canViewUsers ? [
          { href: "/admin/usuarios", label: "Ver equipo" },
          { href: "/admin/invitaciones", label: "Agregar una persona" },
        ] : []),
        ...(canViewRoles ? [
          { href: "/admin/roles", label: "Roles y permisos" },
          { href: "/admin/permisos", label: "Catálogo de permisos" },
        ] : []),
      ],
      title: "Equipo y acceso",
    } : null,
    canViewFiscal ? {
      description: "Factura electrónica y servicios externos. Cada conexión se revisa antes de activarse.",
      icon: Cable,
      links: [
        { href: "/admin/conexiones", label: "Conectar servicios" },
        { href: "/admin/fiscal", label: "Perfil tributario" },
      ],
      title: "Facturación y conexiones",
    } : null,
    canViewAi || canViewSettings ? {
      description: "Define cómo representa Biz.OS a tu negocio y las herramientas que lo asisten.",
      icon: Sparkles,
      links: [
        ...(canViewSettings ? [{ href: "/admin/contexto", label: "Contexto del negocio" }] : []),
        ...(canViewAi ? [{ href: "/admin/ia", label: "Business Brain" }] : []),
      ],
      title: "Automatización e IA",
    } : null,
    canViewSettings ? {
      description: "Logo, colores y recordatorios que ayudan a que Biz.OS se sienta como tu negocio.",
      icon: Palette,
      links: [{ href: "/admin/apariencia", label: "Apariencia y avisos" }],
      title: "Experiencia",
    } : null,
  ].filter((group): group is SettingsGroup => group !== null);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Encuentra lo que necesitas sin recorrer listas largas. Cada ajuste está agrupado según la decisión que quieres tomar."
        eyebrow="Configuración"
        title="Ajustes"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <InfoCard
          items={[
            { label: "Empresa", value: data.empresa?.nombre },
            { label: "Plan", value: data.plan?.codigo },
            { label: "Módulos activos", value: data.modules.length },
            { label: "Tu acceso", value: data.rol?.nombre },
          ]}
          title="Tu configuración actual"
        />
        <aside className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 font-bold text-emerald-950">
            <BadgeCheck aria-hidden="true" size={20} />
            Configuración ordenada
          </div>
          <p className="mt-2 text-sm leading-5 text-emerald-900">
            Los ajustes avanzados se abren solo cuando los necesitas. Tu operación diaria no cambia.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-950">
            <ShieldCheck aria-hidden="true" size={16} />
            Tu acceso: {data.rol?.nombre ?? "Administración"}
          </div>
        </aside>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => <SettingsGroupCard group={group} key={group.title} />)}
      </div>
    </section>
  );
}
