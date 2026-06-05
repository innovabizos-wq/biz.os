import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { ConsultationManagementForm } from "@/modules/consultations/components/consultation-management-form";
import { ConsultationResultCard } from "@/modules/consultations/components/consultation-result-card";
import { ConsultationSearchForm } from "@/modules/consultations/components/consultation-search-form";
import { consultationSearchSchema } from "@/modules/consultations/schemas";
import { getConsultationSearchResult } from "@/modules/consultations/queries";
import type { ConsultationSearchResult } from "@/modules/consultations/types";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type NewConsultationPageProps = {
  searchParams?: Promise<{
    consulta_estado?: string;
    documento?: string;
    error?: string;
  }>;
};

function getBlankConsultationResult(documento = ""): ConsultationSearchResult {
  return {
    documento,
    message: "Completa la informacion para iniciar una gestion.",
    source: "manual",
  };
}

export default async function NewConsultationPage({
  searchParams,
}: NewConsultationPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canViewCustomers = hasPermission(
    access.tenant.permissions,
    "crm.customers.view",
  );
  const canCreateCustomer = hasPermission(
    access.tenant.permissions,
    "crm.customers.create",
  );
  const canSaveInteraction = hasPermission(
    access.tenant.permissions,
    "crm.interactions.create",
  );
  const canCreateQuote = hasPermission(access.tenant.permissions, "quotes.create");

  if (!canViewCustomers) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Solicita acceso al administrador."
          eyebrow="CRM"
          title="Nueva consulta"
        />
        <EmptyState
          description="No tienes permiso para buscar clientes."
          title="Acceso denegado"
        />
      </section>
    );
  }

  let result: ConsultationSearchResult | null = getBlankConsultationResult(
    params?.documento ?? "",
  );
  let searchMessage: string | null = null;
  const parsedDocument = params?.documento
    ? consultationSearchSchema.safeParse({ documento: params.documento })
    : null;

  if (parsedDocument?.success) {
    const searchResult = await getConsultationSearchResult(
      access.tenant,
      parsedDocument.data.documento,
    );

    if (searchResult.ok) {
      result = searchResult.data;
    } else {
      searchMessage = "No se pudo completar la busqueda. Intenta de nuevo.";
      result = getBlankConsultationResult(parsedDocument.data.documento);
    }
  } else if (params?.documento) {
    searchMessage = "La identificacion debe tener entre 9 y 12 digitos numericos.";
  }

  if (params?.consulta_estado === "saved") {
    searchMessage = "Gestion guardada correctamente.";
  }

  if (params?.consulta_estado === "quote_pending") {
    searchMessage =
      "Gestion guardada correctamente. La cotizacion queda pendiente de conectar.";
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        description="Busca una persona o empresa por cedula para iniciar una gestion."
        eyebrow="CRM"
        title="Nueva consulta"
        titleClassName="text-2xl font-semibold normal-case tracking-normal"
      />

      {params?.error ? <EphemeralPageAlert error={params.error} /> : null}
      {searchMessage ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {searchMessage}
        </p>
      ) : null}

      <ConsultationSearchForm defaultDocumento={params?.documento ?? ""} />
      <ConsultationResultCard result={result} />
      <ConsultationManagementForm
        canCreateCustomer={canCreateCustomer}
        canCreateQuote={canCreateQuote}
        canSaveInteraction={canSaveInteraction}
        result={result}
        returnTo="/consultas/nueva"
      />
    </section>
  );
}
