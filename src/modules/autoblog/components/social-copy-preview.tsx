"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { AutoblogArticle } from "@/modules/autoblog/types";

type SocialCopyPreviewProps = {
  article: AutoblogArticle;
};

const channels = [
  ["Facebook", "socialFacebook"],
  ["Instagram", "socialInstagram"],
  ["LinkedIn", "socialLinkedin"],
  ["WhatsApp", "socialWhatsapp"],
] as const;

export function SocialCopyPreview({ article }: SocialCopyPreviewProps) {
  const [message, setMessage] = useState<string | null>(null);

  async function copyCopy(text: string | null) {
    if (!text || !navigator.clipboard) {
      setMessage("No hay texto para copiar.");
      return;
    }

    await navigator.clipboard.writeText(text);
    setMessage("Copy copiado.");
  }

  return (
    <section className="rounded-lg border bg-background p-5">
      <div>
        <h2 className="text-base font-semibold">Copys para redes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Textos preparados para copiar y publicar manualmente.
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {channels.map(([label, key]) => (
          <article className="rounded-lg border bg-muted/30 p-4" key={key}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{label}</p>
              <Button
                disabled={!article[key]}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => copyCopy(article[key])}
              >
                Copiar
              </Button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {article[key] || "Sin copy preparado."}
            </p>
          </article>
        ))}
      </div>
      {message ? (
        <p className="mt-3 rounded-md border bg-muted px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
