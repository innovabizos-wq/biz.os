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
        className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          isInternal
            ? "bg-amber-50 text-amber-900 ring-1 ring-amber-100"
            : isOutgoing
              ? "rounded-br-md bg-[#dcf8c6] text-slate-900"
              : "rounded-bl-md bg-white text-slate-900"
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
