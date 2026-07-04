import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { getCurrentTenantContext } from "@/lib/auth/session";
import { BrainActionTestPanel } from "@/modules/brain/components/brain-action-test-panel";
import {
  saveBrainAiSettingsAction,
  testBrainAiConnectionAction,
} from "@/modules/ai/actions";
import { getAiProviderSettings, getAiUsageEvents } from "@/modules/ai/queries";

type AiSettingsPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-CR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function BrainStatusBadge({
  enabled,
  hasApiKey,
  status,
}: {
  enabled: boolean;
  hasApiKey: boolean;
  status: "error" | "success" | null;
}) {
  const label = !enabled
    ? "Inactiva"
    : !hasApiKey
      ? "Sin configurar"
      : status === "success"
          ? "Conectada al API"
          : status === "error"
            ? "Error"
            : "Activa";

  return (
    <span className="rounded-full border px-2.5 py-1 text-xs font-medium">
      {label}
    </span>
  );
}

export default async function AiSettingsPage({ searchParams }: AiSettingsPageProps) {
  const [params, tenantResult] = await Promise.all([
    searchParams,
    getCurrentTenantContext(),
  ]);

  if (!tenantResult.ok) {
    redirect("/login");
  }

  if (!tenantResult.data) {
    redirect("/onboarding");
  }

  const tenant = tenantResult.data;
  const [settingsResult, usageResult] = await Promise.all([
    getAiProviderSettings(tenant),
    getAiUsageEvents(tenant),
  ]);

  if (!settingsResult.ok) {
    return (
      <section className="space-y-6">
        <PageHeader
          description={settingsResult.error.message}
          eyebrow="Plataforma"
          title="Business Brain"
        />
      </section>
    );
  }

  const settings = settingsResult.data;
  const usage = usageResult.ok ? usageResult.data : [];

  return (
    <section className="space-y-6">
      <PageHeader
        description="Una sola configuracion para Brain, respuestas conversacionales y auditoria de uso."
        eyebrow="Plataforma"
        title="Business Brain"
      />

      {params?.error || params?.success ? (
        <EphemeralPageAlert error={params.error} success={params.success} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form action={saveBrainAiSettingsAction} className="rounded-lg border bg-background p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Brain central</h2>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Una sola configuracion para analisis, respuestas conversacionales y
                naturalizacion de salidas tecnicas.
              </p>
            </div>
            <BrainStatusBadge
              enabled={settings.enabled}
              hasApiKey={settings.hasApiKey}
              status={settings.lastTestStatus}
            />
          </div>

          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Cuando esta conexion esta activa, el Brain interpreta mensajes, responde
            preguntas y comunica resultados con el mismo proveedor.
          </div>

          <div className="mt-5 grid gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                defaultChecked={settings.enabled}
                name="enabled"
                type="checkbox"
                value="true"
              />
              Activar Brain e IA conversacional
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Proveedor de IA</span>
                <select
                  className="rounded-md border bg-background px-3 py-2"
                  defaultValue={settings.provider}
                  name="provider"
                >
                  <option value="gemini">Gemini</option>
                  <option value="openai-compatible">OpenAI compatible</option>
                  <option value="groq-compatible">Groq compatible</option>
                  <option value="openrouter-compatible">OpenRouter compatible</option>
                  <option value="ollama-compatible">Local / Ollama compatible</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Modelo</span>
                <input
                  className="rounded-md border bg-background px-3 py-2"
                  defaultValue={settings.model}
                  name="model"
                  placeholder="gemini-2.5-flash-lite"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">API Key</span>
                <input
                  className="rounded-md border bg-background px-3 py-2"
                  name="apiKey"
                  placeholder={
                    settings.apiKeyLast4
                      ? `Configurada: ************${settings.apiKeyLast4}`
                      : "No configurada"
                  }
                  type="password"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Base URL opcional</span>
                <input
                  className="rounded-md border bg-background px-3 py-2"
                  defaultValue={settings.baseUrl ?? ""}
                  name="baseUrl"
                  placeholder="https://api.openai.com/v1"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Limite diario</span>
                <input
                  className="rounded-md border bg-background px-3 py-2"
                  defaultValue={settings.dailyLimit}
                  min="1"
                  name="dailyLimit"
                  placeholder="Limite diario"
                  type="number"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Maximo de tokens</span>
                <input
                  className="rounded-md border bg-background px-3 py-2"
                  defaultValue={settings.maxTokens}
                  max="8000"
                  min="100"
                  name="maxTokens"
                  type="number"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Temperatura</span>
                <input
                  className="rounded-md border bg-background px-3 py-2"
                  defaultValue={settings.temperature}
                  max="2"
                  min="0"
                  name="temperature"
                  step="0.1"
                  type="number"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Modo de salida</span>
                <select
                  className="rounded-md border bg-background px-3 py-2"
                  defaultValue={settings.outputMode}
                  name="outputMode"
                >
                  <option value="strict_json">JSON estricto</option>
                  <option value="natural_text">Texto natural</option>
                </select>
              </label>
            </div>

            <div className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Estado de conexion</p>
                <p className="font-medium">
                  {settings.lastTestStatus === "success"
                    ? "Conexion correcta al API"
                    : settings.lastTestStatus === "error"
                      ? "Error de conexion"
                      : settings.hasApiKey
                        ? "Lista para probar"
                        : "Sin clave configurada"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Ultima prueba</p>
                <p className="font-medium">
                  {settings.lastTestAt ? formatDate(settings.lastTestAt) : "Pendiente"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Detalle</p>
                <p className="font-medium">
                  {settings.lastTestMessage ?? "Sin mensaje"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <PendingSubmitButton pendingLabel="Guardando">
                Guardar configuracion
              </PendingSubmitButton>
              <PendingSubmitButton
                formAction={testBrainAiConnectionAction}
                pendingLabel="Probando"
                variant="outline"
              >
                Probar conexion al API
              </PendingSubmitButton>
            </div>
          </div>
        </form>

        <div className="rounded-lg border bg-background p-5">
          <h2 className="text-base font-semibold">Salud de conexion</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Estado</dt>
              <dd>{settings.enabled ? "Activo" : "Inactivo"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Proveedor</dt>
              <dd>{settings.provider}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Modelo</dt>
              <dd>{settings.model}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Credencial</dt>
              <dd>{settings.hasApiKey ? "Presente" : "Pendiente"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Limite diario</dt>
              <dd>{settings.dailyLimit.toLocaleString("es-CR")}</dd>
            </div>
          </dl>
        </div>
      </div>

      <BrainActionTestPanel />

      <div className="rounded-lg border bg-background p-5">
        <h2 className="text-base font-semibold">Auditoria reciente</h2>
        <div className="mt-4 grid gap-3">
          {usage.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay eventos IA registrados.</p>
          ) : (
            usage.map((event) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
                key={event.id}
              >
                <div>
                  <strong>{event.feature}</strong>
                  <p className="text-muted-foreground">
                    {event.profileNombre ?? "Usuario"} - {event.status}
                  </p>
                </div>
                <time className="text-muted-foreground">{formatDate(event.createdAt)}</time>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
