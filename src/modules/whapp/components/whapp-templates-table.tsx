import {
  INBOX_META_TEMPLATE_CATEGORY_LABELS,
  INBOX_META_TEMPLATE_STATUS_LABELS,
} from "@/modules/inbox/constants";
import type { InboxMetaTemplate } from "@/modules/inbox/types";

type WhappTemplatesTableProps = {
  templates: InboxMetaTemplate[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-CR");
}

function statusClassName(status: InboxMetaTemplate["estado"]) {
  if (status === "aprobada") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "rechazada") return "border-red-200 bg-red-50 text-red-800";
  if (status === "pendiente") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function WhappTemplatesTable({ templates }: WhappTemplatesTableProps) {
  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Plantilla</th>
            <th className="px-4 py-3">Canal</th>
            <th className="px-4 py-3">Categoria</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Variables</th>
            <th className="px-4 py-3">Actualizada</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr className="border-t align-top" key={template.id}>
              <td className="max-w-md px-4 py-3">
                <p className="font-medium">{template.nombre}</p>
                <p className="text-xs text-muted-foreground">{template.idioma}</p>
                <p className="mt-2 line-clamp-2 text-muted-foreground">
                  {template.cuerpo}
                </p>
              </td>
              <td className="px-4 py-3">
                {template.canalNombre ?? "Todos los WhatsApp Meta"}
              </td>
              <td className="px-4 py-3">
                {INBOX_META_TEMPLATE_CATEGORY_LABELS[template.categoria]}
              </td>
              <td className="px-4 py-3">
                <span
                  className={[
                    "inline-flex rounded-full border px-2 py-1 text-xs font-bold",
                    statusClassName(template.estado),
                  ].join(" ")}
                >
                  {INBOX_META_TEMPLATE_STATUS_LABELS[template.estado]}
                </span>
              </td>
              <td className="px-4 py-3">
                {template.variables.length > 0
                  ? template.variables.join(", ")
                  : "Sin variables"}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {formatDate(template.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
