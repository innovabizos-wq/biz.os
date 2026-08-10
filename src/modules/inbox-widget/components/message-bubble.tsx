import Image from "next/image";

import type { InboxWidgetMessage } from "@/modules/inbox-widget/types";

type MessageBubbleProps = {
  message: InboxWidgetMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutgoing = message.direccion === "saliente";
  const isInternal = message.esNotaInterna || message.direccion === "interna";
  const mediaUrl = `/api/inbox/media/${message.id}`;
  const isMedia = ["audio", "documento", "imagen", "video"].includes(message.tipo);

  return (
    <div
      className={`flex ${isOutgoing ? "justify-end" : "justify-start"} ${
        isInternal ? "justify-center" : ""
      }`}
    >
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-[0_14px_30px_rgba(15,23,42,0.13)] ring-1 backdrop-blur ${
          isInternal
            ? "bg-amber-50/95 text-amber-900 ring-amber-100"
            : isOutgoing
              ? "rounded-br-md bg-gradient-to-br from-[#e7ffd9] via-[#dcf8c6] to-[#c7f3b7] text-slate-900 ring-emerald-100"
              : "rounded-bl-md bg-white/95 text-slate-900 ring-white/80"
        }`}
      >
        {message.tipo === "imagen" ? (
          <a href={mediaUrl} rel="noreferrer" target="_blank">
            <Image
              alt={message.contenido ?? "Imagen adjunta"}
              className="mb-2 h-auto max-h-80 w-auto max-w-full rounded-xl object-contain"
              height={360}
              src={mediaUrl}
              unoptimized
              width={480}
            />
          </a>
        ) : null}
        {message.tipo === "audio" ? (
          <audio className="mb-2 max-w-full" controls preload="none" src={mediaUrl}>
            Tu navegador no puede reproducir este audio.
          </audio>
        ) : null}
        {message.tipo === "video" ? (
          <video className="mb-2 max-h-80 max-w-full rounded-xl" controls preload="metadata" src={mediaUrl}>
            Tu navegador no puede reproducir este video.
          </video>
        ) : null}
        {message.tipo === "documento" ? (
          <a
            className="mb-2 block rounded-xl border border-current/15 bg-white/50 px-3 py-2 font-black underline-offset-2 hover:underline"
            href={mediaUrl}
            rel="noreferrer"
            target="_blank"
          >
            Abrir archivo adjunto
          </a>
        ) : null}
        <p className="whitespace-pre-wrap break-words">
          {message.contenido ?? (isInternal ? "Nota interna" : isMedia ? "Adjunto" : "Mensaje sin texto")}
        </p>
        <p className="mt-1 text-right text-[10px] text-slate-500">
          {new Date(message.createdAt).toLocaleTimeString("es-CR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
