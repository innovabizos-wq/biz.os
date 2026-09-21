import Link from "next/link";

import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import {
  toggleInboxFunnelStageAction,
  upsertInboxFunnelStageAction,
  upsertInboxLabelAction,
} from "@/modules/whapp/classification-actions";

type ClassificationPageProps = { searchParams?: Promise<{ error?: string; success?: string }> };

export default async function ClassificationPage({ searchParams }: ClassificationPageProps) {
  const [access, query] = await Promise.all([requireAdminAccess(), searchParams]);
  const canManage = hasPermission(access.tenant.permissions, "inbox.channels.manage");
  const supabase = await createClient();
  const [{ data: labels }, { data: funnels }] = await Promise.all([
    supabase.from("inbox_etiquetas").select("id, nombre, color, activa").eq("empresa_id", access.tenant.empresaId).order("nombre"),
    supabase.from("inbox_funnels").select("id, nombre, activo, etapas:inbox_funnel_etapas(id, nombre, posicion, color, activa)").eq("empresa_id", access.tenant.empresaId).order("nombre"),
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader description="Administra etiquetas reutilizables y etapas ordenadas. El popup solo consume este catalogo; su diseño no cambia." eyebrow="Whapp" title="Etiquetas y funnels" />
        <Link className={buttonVariants({ variant: "outline" })} href="/whapp">Volver a Whapp</Link>
      </div>
      {query?.error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{query.error}</p> : null}
      {query?.success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{query.success}</p> : null}

      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <form action={upsertInboxLabelAction} className="grid gap-3 rounded-lg border bg-background p-5">
            <h2 className="font-semibold">Nueva etiqueta</h2>
            <input className="h-10 rounded-md border px-3" name="nombre" placeholder="Ej. Urgente" required />
            <label className="text-sm">Color <input className="ml-2 h-9 w-16 align-middle" defaultValue="#ef4444" name="color" type="color" /></label>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground" type="submit">Guardar etiqueta</button>
          </form>
          <form action={upsertInboxFunnelStageAction} className="grid gap-3 rounded-lg border bg-background p-5">
            <h2 className="font-semibold">Nueva etapa</h2>
            <select className="h-10 rounded-md border px-3" name="funnelId">
              <option value="">Crear funnel nuevo</option>
              {(funnels ?? []).map((funnel) => <option key={funnel.id} value={funnel.id}>{funnel.nombre}</option>)}
            </select>
            <input className="h-10 rounded-md border px-3" name="funnelNombre" placeholder="Nombre si es funnel nuevo" />
            <input className="h-10 rounded-md border px-3" name="etapaNombre" placeholder="Ej. Calificado" required />
            <input className="h-10 rounded-md border px-3" defaultValue="0" min="0" name="posicion" type="number" />
            <label className="text-sm">Color <input className="ml-2 h-9 w-16 align-middle" defaultValue="#0ea5e9" name="color" type="color" /></label>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground" type="submit">Guardar etapa</button>
          </form>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-background p-5">
          <h2 className="font-semibold">Etiquetas</h2>
          <div className="mt-4 space-y-3">
            {(labels ?? []).map((label) => (
              <form action={upsertInboxLabelAction} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2" key={label.id}>
                <input name="etiquetaId" type="hidden" value={label.id} />
                <input className="h-9 rounded-md border px-3" defaultValue={label.nombre} name="nombre" readOnly={!canManage} />
                <input defaultValue={label.color} disabled={!canManage} name="color" type="color" />
                <select className="h-9 rounded-md border px-2 text-xs" defaultValue={String(label.activa)} disabled={!canManage} name="activa"><option value="true">Activa</option><option value="false">Inactiva</option></select>
                {canManage ? <button className="rounded-md border px-3 py-2 text-xs font-bold" type="submit">Guardar</button> : null}
              </form>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {(funnels ?? []).map((funnel) => (
            <div className="rounded-lg border bg-background p-5" key={funnel.id}>
              <h2 className="font-semibold">{funnel.nombre}</h2>
              <div className="mt-3 space-y-2">
                {[...(funnel.etapas ?? [])].sort((a, b) => a.posicion - b.posicion).map((stage) => (
                  <div className="rounded-md border p-2" key={stage.id}>
                    <form action={upsertInboxFunnelStageAction} className="grid grid-cols-[1fr_70px_auto_auto] items-center gap-2">
                      <input name="funnelId" type="hidden" value={funnel.id} />
                      <input name="etapaId" type="hidden" value={stage.id} />
                      <input name="funnelNombre" type="hidden" value={funnel.nombre} />
                      <input className="h-9 rounded-md border px-3 text-sm" defaultValue={stage.nombre} name="etapaNombre" readOnly={!canManage} />
                      <input className="h-9 rounded-md border px-2" defaultValue={stage.posicion} min="0" name="posicion" readOnly={!canManage} type="number" />
                      <input defaultValue={stage.color} disabled={!canManage} name="color" type="color" />
                      {canManage ? <button className="text-xs font-bold" type="submit">Guardar</button> : null}
                    </form>
                    {canManage ? <form action={toggleInboxFunnelStageAction} className="mt-1 text-right"><input name="etapaId" type="hidden" value={stage.id} /><input name="activa" type="hidden" value={stage.activa ? "false" : "true"} /><button className="text-xs font-bold text-muted-foreground" type="submit">{stage.activa ? "Desactivar" : "Activar"}</button></form> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
