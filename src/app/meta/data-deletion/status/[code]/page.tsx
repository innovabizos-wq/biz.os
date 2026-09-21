import { notFound } from "next/navigation";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export default async function MetaDataDeletionStatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("inbox_meta_data_deletion_requests")
    .select("confirmation_code, estado, affected_channels, requested_at, completed_at")
    .eq("confirmation_code", code)
    .maybeSingle<{
      affected_channels: number;
      completed_at: string | null;
      confirmation_code: string;
      estado: string;
      requested_at: string;
    }>();
  if (!data) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16">
      <section className="w-full rounded-2xl border bg-background p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">biz.os</p>
        <h1 className="mt-2 text-3xl font-bold">Eliminacion de datos de Meta</h1>
        <p className="mt-4 text-muted-foreground">
          La solicitud fue procesada. Las credenciales asociadas se eliminaron y los canales afectados quedaron inactivos.
        </p>
        <dl className="mt-6 grid gap-3 text-sm">
          <div><dt className="font-semibold">Codigo de confirmacion</dt><dd>{data.confirmation_code}</dd></div>
          <div><dt className="font-semibold">Estado</dt><dd>{data.estado}</dd></div>
          <div><dt className="font-semibold">Canales afectados</dt><dd>{data.affected_channels}</dd></div>
        </dl>
      </section>
    </main>
  );
}
