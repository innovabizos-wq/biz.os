import type { CSSProperties } from "react";

import type { Quote, QuoteItem } from "@/modules/quotes/types";
import type { QuoteDocumentCompany, QuoteDocumentSettings } from "@/modules/quotes/quote-document-style";

type QuotePrintDocumentProps = { company: QuoteDocumentCompany; items: QuoteItem[]; quote: Quote; settings: QuoteDocumentSettings };

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", { currency, style: "currency" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "No definido";
  return new Intl.DateTimeFormat("es-CR", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function templateClasses(template: QuoteDocumentSettings["templateCode"]) {
  return {
    bold: { article: "border-0", header: "rounded-2xl", total: "rounded-xl" },
    classic: { article: "border-2", header: "border-b-4", total: "border-y" },
    editorial: { article: "border-0", header: "border-b-8", total: "border-l-4 pl-4" },
    executive: { article: "border", header: "border-b", total: "rounded-xl" },
    minimal: { article: "border-0 shadow-none", header: "border-b", total: "border-t-2" },
  }[template];
}

export function QuotePrintDocument({ company, items, quote, settings }: QuotePrintDocumentProps) {
  const classes = templateClasses(settings.templateCode);
  const accentStyle = { "--quote-accent": settings.accentColor } as CSSProperties;
  const companyName = company.tradeName || company.name;

  return (
    <article className={`quote-print-document mx-auto min-h-[297mm] max-w-[210mm] bg-white p-8 text-slate-950 shadow-sm print:min-h-0 print:w-full print:max-w-none print:p-0 print:shadow-none ${classes.article}`} style={accentStyle}>
      <header className={`flex flex-wrap items-start justify-between gap-7 pb-6 ${classes.header}`} style={{ borderColor: settings.accentColor }}>
        <div className="flex min-w-0 items-start gap-4">
          {settings.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={companyName} className="max-h-16 max-w-40 object-contain object-left" src={settings.logoDataUrl} />
          ) : <div className="flex size-14 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white" style={{ backgroundColor: settings.accentColor }}>{companyName.slice(0, 1).toUpperCase()}</div>}
          <div className="min-w-0"><p className="text-xl font-black tracking-tight">{companyName}</p>{company.name !== companyName ? <p className="mt-0.5 text-sm text-slate-500">{company.name}</p> : null}<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">{company.identification ? <span>ID {company.identification}</span> : null}{company.phone ? <span>{company.phone}</span> : null}{company.email ? <span>{company.email}</span> : null}</div></div>
        </div>
        <div className="min-w-48 text-right"><p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{settings.documentLabel}</p><p className="mt-1 text-4xl font-black tracking-tight" style={{ color: settings.accentColor }}>{quote.numero}</p><p className="mt-2 text-sm text-slate-500">Emisión {formatDate(quote.fechaEmision)}</p><p className="text-sm text-slate-500">Válida hasta {formatDate(quote.fechaVencimiento)}</p></div>
      </header>
      <section className="grid gap-4 border-b py-6 text-sm sm:grid-cols-[1fr_auto]"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Para</p><p className="mt-1 text-lg font-bold">{quote.clienteNombre ?? "Cliente no definido"}</p></div><div className="sm:text-right"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Preparado por</p><p className="mt-1 font-semibold">{quote.creadoPorNombre ?? companyName}</p><p className="mt-1 capitalize text-slate-500">Estado: {quote.estado}</p></div></section>
      <section className="py-6"><table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500" style={{ borderColor: settings.accentColor }}><th className="py-3 pr-3">Descripción</th><th className="px-2 py-3 text-right">Cant.</th><th className="px-2 py-3 text-right">Precio</th><th className="px-2 py-3 text-right">Imp.</th><th className="py-3 pl-2 text-right">Total</th></tr></thead><tbody>{items.length ? items.map((item) => <tr className="border-b align-top" key={item.id}><td className="py-4 pr-3"><p className="font-semibold">{item.descripcion}</p>{item.productoNombre ? <p className="mt-1 text-xs text-slate-500">{item.productoCodigo ? `${item.productoCodigo} · ` : ""}{item.productoNombre}</p> : null}</td><td className="px-2 py-4 text-right">{item.cantidad}</td><td className="px-2 py-4 text-right">{formatMoney(item.precioUnitario, quote.moneda)}</td><td className="px-2 py-4 text-right">{formatMoney(item.impuestoMonto, quote.moneda)}</td><td className="py-4 pl-2 text-right font-bold">{formatMoney(item.total, quote.moneda)}</td></tr>) : <tr><td className="py-8 text-slate-500" colSpan={5}>No hay ítems registrados.</td></tr>}</tbody></table></section>
      <section className={`ml-auto max-w-sm space-y-2 text-sm ${classes.total}`} style={{ borderColor: settings.accentColor }}><div className="flex justify-between gap-8"><span className="text-slate-500">Subtotal</span><span>{formatMoney(quote.subtotal, quote.moneda)}</span></div><div className="flex justify-between gap-8"><span className="text-slate-500">Descuento</span><span>{formatMoney(quote.descuentoTotal, quote.moneda)}</span></div><div className="flex justify-between gap-8"><span className="text-slate-500">Impuesto</span><span>{formatMoney(quote.impuestoTotal, quote.moneda)}</span></div><div className="mt-3 flex justify-between gap-8 border-t pt-3 text-xl font-black" style={{ borderColor: settings.accentColor }}><span>Total</span><span style={{ color: settings.accentColor }}>{formatMoney(quote.total, quote.moneda)}</span></div></section>
      {quote.condiciones || quote.notas ? <section className="mt-9 grid gap-6 border-t pt-6 md:grid-cols-2">{quote.condiciones ? <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Condiciones</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{quote.condiciones}</p></div> : null}{quote.notas ? <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Notas</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{quote.notas}</p></div> : null}</section> : null}
      <footer className="mt-10 border-t pt-5 text-center text-sm text-slate-500">{settings.footerText || "Gracias por considerar nuestra propuesta."}</footer>
    </article>
  );
}
