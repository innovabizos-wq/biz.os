import Link from "next/link";
import { Building2, HeartPulse, MessageCircle, ShieldX, Smartphone } from "lucide-react";

import {
  PlatformBadge,
  PlatformCard,
  PlatformSectionHeader,
} from "@/modules/platform-console/components";

const supportFlow = [
  {
    description: "Buscar la empresa cliente y abrir su ficha interna.",
    href: "/platform/empresas",
    icon: Building2,
    title: "1. Identificar empresa",
  },
  {
    description: "Revisar modulos, billing, usuarios y actividad reciente.",
    href: "/platform/empresas",
    icon: HeartPulse,
    title: "2. Diagnosticar estado",
  },
  {
    description: "Validar si el problema viene de Whapp, webhook o proveedor Meta.",
    href: "/platform/whapp",
    icon: Smartphone,
    title: "3. Revisar Whapp",
  },
  {
    description: "Usar Health para priorizar errores reales antes de escalar.",
    href: "/platform/health",
    icon: MessageCircle,
    title: "4. Documentar soporte",
  },
];

export default function PlatformSupportPage() {
  return (
    <section className="space-y-6">
      <PlatformSectionHeader
        description="Guia interna para atender clientes sin mezclar Platform Console con la app del tenant."
        eyebrow="Soporte"
        title="Soporte interno"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {supportFlow.map((item) => {
          const Icon = item.icon;

          return (
            <Link href={item.href} key={item.title}>
              <PlatformCard className="h-full transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                <Icon className="size-6 text-blue-700" aria-hidden />
                <h3 className="mt-3 font-black text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </PlatformCard>
            </Link>
          );
        })}
      </div>

      <PlatformCard className="border-amber-200 bg-amber-50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldX className="size-5 text-amber-800" aria-hidden />
              <h3 className="font-black text-amber-950">Acciones bloqueadas por seguridad</h3>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">
              No hay impersonacion, borrado de empresas, edicion de secretos, cambios fiscales
              sensibles ni suspension/reactivacion desde esta primera version. Es deliberado para
              operar sin romper tenants.
            </p>
          </div>
          <PlatformBadge tone="amber">Fase segura</PlatformBadge>
        </div>
      </PlatformCard>
    </section>
  );
}

