import type { InboxWidgetMessage } from "@/modules/inbox-widget/types";

type MessageBubbleProps = {
  message: InboxWidgetMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutgoing = message.direccion === "saliente";
  const isInternal = message.esNotaInterna || message.direccion === "interna";

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
        <p className="whitespace-pre-wrap break-words">
          {message.contenido ?? (isInternal ? "Nota interna" : "Mensaje sin texto")}
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
