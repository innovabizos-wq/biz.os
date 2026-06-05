"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type AutoblogPublishingToolsProps = {
  articleContent: string;
  articleTitle: string;
};

async function copyText(text: string) {
  if (!navigator.clipboard) return false;

  await navigator.clipboard.writeText(text);
  return true;
}

export function AutoblogPublishingTools({
  articleContent,
  articleTitle,
}: AutoblogPublishingToolsProps) {
  const [message, setMessage] = useState<string | null>(null);

  async function copyArticle() {
    const ok = await copyText(`${articleTitle}\n\n${articleContent}`.trim());
    setMessage(ok ? "Articulo copiado." : "No se pudo copiar.");
  }

  async function copyInternalLink() {
    const ok = await copyText(window.location.href);
    setMessage(ok ? "Enlace interno copiado." : "No se pudo copiar.");
  }

  return (
    <section className="rounded-lg border bg-background p-5">
      <div>
        <h2 className="text-base font-semibold">Publicacion y uso</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Acciones preparadas para operar el articulo dentro de biz.os.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Button type="button" variant="outline" onClick={copyArticle}>
          Copiar articulo
        </Button>
        <Button type="button" variant="outline" onClick={copyInternalLink}>
          Copiar enlace interno
        </Button>
        <Button disabled type="button" variant="outline">
          Publicar en web
        </Button>
        <Button disabled type="button" variant="outline">
          Compartir en redes
        </Button>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Web y redes quedan visibles como flujo futuro. Se habilitaran cuando exista
        sitio o canales conectados para esta empresa.
      </p>

      {message ? (
        <p className="mt-3 rounded-md border bg-muted px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
