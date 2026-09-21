import Link from "next/link";
import { ArrowRight, MessageCircle, ShieldCheck, Smartphone } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import {
  PlatformBadge,
  PlatformCard,
  PlatformSectionHeader,
  statusTone,
} from "@/modules/platform-console/components";
import {
  getPlatformMetaRates,
  getPlatformWhappChannels,
} from "@/modules/platform-console/queries";
import { upsertMetaRateAction } from "@/modules/whapp/platform-actions";

function formatDate(value: string | null) {
  if (!value) return "Sin eventos";

  return new Date(value).toLocaleString("es-CR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type PlatformWhappPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function PlatformWhappPage({ searchParams }: PlatformWhappPageProps) {
  const [channels, rates, query] = await Promise.all([
    getPlatformWhappChannels(),
    getPlatformMetaRates(),
    searchParams,
  ]);

  if (!channels.ok) {
    return <EmptyState description={channels.error.message} title="Whapp" />;
  }

  if (!rates.ok) {
    return <EmptyState description={rates.error.message} title="Tarifas Meta" />;
  }

  const pendingChannels = channels.data.filter((channel) =>
    ["pendiente", "error"].includes(channel.connectionStatus),
  ).length;
  return (
    <section className="space-y-6">
      <PlatformSectionHeader
        description="Whapp funciona como proveedor administrado por biz.os. El cliente usa su numero asignado; AInovaCR supervisa proveedor, WABA, Phone Number ID, webhook y errores."
        eyebrow="Provider model"
        title="Whapp"
      />

      {query?.error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{query.error}</p> : null}
      {query?.success ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{query.success}</p> : null}

      <PlatformCard>
        <h2 className="text-lg font-black text-slate-950">Tarifas oficiales de Meta</h2>
        <p className="mt-1 text-sm text-slate-500">Registra cada vigencia desde la tabla oficial. Whapp bloquea campanas cuyo mercado o categoria no tenga tarifa vigente.</p>
        <form action={upsertMetaRateAction} className="mt-4 grid gap-3 md:grid-cols-4">
          <input className="rounded-lg border px-3 py-2" name="marketCode" placeholder="MEXICO o REST_OF_LATIN_AMERICA" required />
          <select className="rounded-lg border px-3 py-2" name="category" required>
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utility</option>
            <option value="AUTHENTICATION">Authentication</option>
            <option value="AUTHENTICATION_INTERNATIONAL">Authentication internacional</option>
            <option value="SERVICE">Service</option>
          </select>
          <input className="rounded-lg border px-3 py-2" defaultValue="USD" name="currency" placeholder="USD" required />
          <input className="rounded-lg border px-3 py-2" min="0" name="unitCost" placeholder="Costo por mensaje" required step="0.000001" type="number" />
          <input className="rounded-lg border px-3 py-2" defaultValue="1" min="1" name="volumeFrom" placeholder="Tramo desde" required step="1" type="number" />
          <input className="rounded-lg border px-3 py-2" min="1" name="volumeTo" placeholder="Tramo hasta (vacio = sin limite)" step="1" type="number" />
          <label className="text-sm font-bold text-slate-600">Desde<input className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" name="effectiveFrom" required type="date" /></label>
          <label className="text-sm font-bold text-slate-600">Hasta<input className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" name="effectiveTo" type="date" /></label>
          <input className="rounded-lg border px-3 py-2 md:col-span-2" name="sourceUrl" placeholder="URL oficial de la tarifa" type="url" />
          <button className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700" type="submit">Guardar tarifa</button>
        </form>
        <div className="mt-5 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Mercado</th><th>Categoria</th><th>Tramo mensual</th><th>Costo</th><th>Vigencia</th><th>Fuente</th></tr></thead>
            <tbody>
              {rates.data.map((rate) => (
                <tr className="border-t" key={rate.id}>
                  <td className="py-2 font-bold">{rate.marketCode}</td>
                  <td>{rate.category}</td>
                  <td>{rate.volumeFrom} - {rate.volumeTo ?? "sin limite"}</td>
                  <td>{rate.currency} {rate.unitCost.toFixed(6)}</td>
                  <td>{rate.effectiveFrom}{rate.effectiveTo ? ` - ${rate.effectiveTo}` : " - vigente"}</td>
                  <td>{rate.sourceUrl ? <a className="text-blue-700 underline" href={rate.sourceUrl} rel="noreferrer" target="_blank">Meta</a> : "Sin fuente"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PlatformCard>

      <div className="grid gap-4 md:grid-cols-3">
        <PlatformCard>
          <div className="flex items-center gap-3">
            <MessageCircle className="size-5 text-blue-700" aria-hidden />
            <div>
              <p className="text-sm font-bold text-slate-500">Canales</p>
              <strong className="text-2xl font-black text-slate-950">{channels.data.length}</strong>
            </div>
          </div>
        </PlatformCard>
        <PlatformCard>
          <div className="flex items-center gap-3">
            <Smartphone className="size-5 text-amber-700" aria-hidden />
            <div>
              <p className="text-sm font-bold text-slate-500">Pendientes/error</p>
              <strong className="text-2xl font-black text-slate-950">{pendingChannels}</strong>
            </div>
          </div>
        </PlatformCard>
        <PlatformCard>
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-emerald-700" aria-hidden />
            <div>
              <p className="text-sm font-bold text-slate-500">Secretos expuestos</p>
              <strong className="text-2xl font-black text-slate-950">0</strong>
            </div>
          </div>
        </PlatformCard>
      </div>

      {channels.data.length === 0 ? (
        <PlatformCard>
          <EmptyState
            description="Aun no hay canales Whapp provisionados."
            title="Whapp"
          />
        </PlatformCard>
      ) : (
        <div className="grid gap-4">
          {channels.data.map((channel) => (
            <PlatformCard key={channel.channelId}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-slate-950">{channel.name}</h3>
                    <PlatformBadge tone={statusTone(channel.connectionStatus)}>
                      {channel.connectionStatus}
                    </PlatformBadge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {channel.companyName ?? channel.companyId}
                  </p>
                </div>
                <Link
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                  href={`/platform/empresas/${channel.companyId}`}
                >
                  Ver empresa
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </div>
              <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                <Info label="Numero asignado / Phone Number ID" value={channel.phoneNumberId ?? "Pendiente"} />
                <Info label="WABA ID" value={channel.wabaId ?? "Pendiente"} />
                <Info label="Proveedor" value={channel.provider} />
                <Info label="Estado canal" value={channel.status} />
                <Info label="Health proveedor" value={channel.healthStatus ?? channel.connectionStatus} />
                <Info label="Webhook" value={channel.webhookUrl ?? "/api/webhooks/meta"} />
                <Info label="Ultimo evento" value={formatDate(channel.lastEventAt)} />
                <div className="md:col-span-2">
                  <Info label="Ultimo error" value={channel.lastError ?? "Sin error reciente"} />
                </div>
              </dl>
              <p className="mt-4 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                No se muestran access tokens, app secrets, verify tokens ni service role.
              </p>
            </PlatformCard>
          ))}
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

