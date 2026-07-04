"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

type PaymentsErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function PaymentsError({ error, unstable_retry }: PaymentsErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-lg border bg-background p-6">
      <p className="app-page-eyebrow">Finanzas</p>
      <h1 className="app-page-title">Pagos no pudo cargar</h1>
      <p className="text-sm text-muted-foreground">
        Ocurrio un error cargando cuentas o movimientos. Puedes reintentar o
        volver al panel principal.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => unstable_retry()} type="button">
          Reintentar
        </Button>
        <Link className={buttonVariants({ variant: "outline" })} href="/dashboard">
          Ir al dashboard
        </Link>
      </div>
    </section>
  );
}
