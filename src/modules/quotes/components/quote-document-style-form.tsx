"use client";

import { ImageUp, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  QUOTE_DOCUMENT_ACCENT_COLORS,
  QUOTE_DOCUMENT_LABELS,
  QUOTE_DOCUMENT_TEMPLATES,
  type QuoteDocumentSettings,
  type QuoteDocumentTemplateCode,
} from "@/modules/quotes/quote-document-style";
import { saveQuoteDocumentSettingsAction } from "@/modules/quotes/document-settings";

function TemplateThumbnail({ template }: { template: QuoteDocumentTemplateCode }) {
  const line = <span className="block h-1.5 rounded bg-slate-200" />;
  if (template === "bold") return <span className="block h-24 bg-slate-50 p-3"><span className="flex h-11 items-center justify-between rounded bg-emerald-700 px-2 text-[8px] font-black uppercase tracking-wider text-white"><span>Proforma</span><span>000123</span></span><span className="mt-3 grid grid-cols-[1fr_34px] gap-2">{line}<span className="h-5 rounded bg-emerald-700" /></span><span className="mt-2 block h-1.5 w-full rounded bg-slate-200" /></span>;
  if (template === "minimal") return <span className="block h-24 bg-white p-3"><span className="flex items-start justify-between"><span className="h-5 w-5 rounded-sm bg-slate-900" /><span className="text-xs font-light text-slate-950">PROFORMA</span></span><span className="mt-5 grid grid-cols-[1fr_26px] gap-2">{line}{line}</span><span className="mt-2 block h-1.5 w-4/5 rounded bg-slate-200" /></span>;
  if (template === "editorial") return <span className="grid h-24 grid-cols-[28px_1fr] bg-white"><span className="bg-violet-900" /><span className="p-3"><span className="block text-[8px] font-black uppercase tracking-wider text-slate-500">Propuesta</span><span className="mt-2 block h-3 w-4/5 rounded bg-slate-900" /><span className="mt-4 grid grid-cols-[1fr_30px] gap-2">{line}{line}</span></span></span>;
  if (template === "classic") return <span className="block h-24 bg-stone-50 p-2"><span className="block h-full border-2 border-stone-600 p-2"><span className="flex justify-between border-b-2 border-stone-600 pb-1 text-[8px] font-serif font-bold"><span>PROFORMA</span><span>N.º 000123</span></span><span className="mt-3 grid grid-cols-[1fr_30px] gap-2">{line}{line}</span></span></span>;
  return <span className="block h-24 bg-white p-3"><span className="flex items-center justify-between border-b-2 border-slate-900 pb-2"><span className="h-6 w-6 rounded bg-slate-900" /><span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Proforma 000123</span></span><span className="mt-3 grid grid-cols-2 gap-2"><span className="h-4 rounded bg-slate-100" /><span className="h-4 rounded border" /></span><span className="mt-2 block h-1.5 w-full rounded bg-slate-200" /></span>;
}

export function QuoteDocumentStyleForm({ settings }: { settings: QuoteDocumentSettings }) {
  const [template, setTemplate] = useState<QuoteDocumentTemplateCode>(settings.templateCode);
  const [logoName, setLogoName] = useState<string | null>(null);

  return (
    <form action={saveQuoteDocumentSettingsAction} className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><Sparkles aria-hidden="true" size={20} /></span>
          <div>
            <h2 className="font-bold text-slate-950">Elige una presentación</h2>
            <p className="mt-1 text-sm text-slate-500">La información y los importes de tus cotizaciones se conservan. Solo cambia el diseño que recibe tu cliente.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {QUOTE_DOCUMENT_TEMPLATES.map((item) => (
            <label className="cursor-pointer" key={item.code}>
              <input className="sr-only" checked={template === item.code} name="templateCode" onChange={() => setTemplate(item.code)} type="radio" value={item.code} />
              <span className={cn(
                "block overflow-hidden rounded-xl border bg-white transition hover:border-slate-400",
                template === item.code && "border-slate-950 ring-2 ring-slate-900/15",
              )}>
                <TemplateThumbnail template={item.code} />
                <span className="block p-3"><span className="block text-sm font-bold text-slate-900">{item.name}</span><span className="mt-1 block text-xs leading-4 text-slate-500">{item.description}</span></span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-5 rounded-2xl border bg-white p-5 shadow-sm lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div>
            <h2 className="font-bold text-slate-950">Personaliza lo esencial</h2>
            <p className="mt-1 text-sm text-slate-500">Solo unos pocos elementos para que el documento se reconozca como tuyo.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold"><span>Nombre del documento</span><select className="h-10 rounded-lg border bg-white px-3" defaultValue={settings.documentLabel} name="documentLabel">{QUOTE_DOCUMENT_LABELS.map((label) => <option key={label} value={label}>{label}</option>)}</select></label>
            <label className="grid gap-1.5 text-sm font-semibold"><span>Color principal</span><select className="h-10 rounded-lg border bg-white px-3" defaultValue={settings.accentColor} name="accentColor">{QUOTE_DOCUMENT_ACCENT_COLORS.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}</select></label>
          </div>
          <label className="grid gap-1.5 text-sm font-semibold"><span>Mensaje al pie</span><textarea className="min-h-24 rounded-lg border p-3 font-normal" defaultValue={settings.footerText ?? ""} maxLength={300} name="footerText" placeholder="Ejemplo: Gracias por considerar nuestra propuesta." /></label>
          <div className="rounded-xl border bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-slate-900">Logo para cotizaciones</p><p className="mt-1 text-sm text-slate-500">PNG, JPG o WebP de hasta 500 KB.</p></div><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-100"><ImageUp size={16} /> Elegir logo<input accept="image/png,image/jpeg,image/webp" className="sr-only" name="logo" onChange={(event) => setLogoName(event.target.files?.[0]?.name ?? null)} type="file" /></label></div>
            {logoName ? <p className="mt-3 text-sm text-emerald-700">Logo seleccionado: {logoName}</p> : settings.logoDataUrl ? <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600"><input name="removeLogo" type="checkbox" value="true" /> <RotateCcw size={14} /> Quitar el logo actual</label> : null}
          </div>
        </div>
        <aside className="overflow-hidden rounded-xl border bg-slate-50">
          <div className={cn(
            "p-5 text-white",
            template === "bold" && "bg-emerald-700",
            template === "editorial" && "bg-violet-900",
            template === "minimal" && "bg-white text-slate-900",
            template === "classic" && "bg-stone-700",
            template === "executive" && "bg-slate-900",
          )}><p className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">Vista previa</p><p className="mt-3 text-4xl font-black">PROFORMA</p><p className="mt-1 text-lg font-semibold opacity-90">000123</p></div>
          <div className="space-y-3 p-5 text-sm"><div className="h-3 w-28 rounded bg-slate-200" /><div className="h-2 w-full rounded bg-slate-100" /><div className="h-2 w-4/5 rounded bg-slate-100" /><div className="ml-auto mt-8 w-28 border-t pt-3 text-right font-black text-slate-900">₡ 125.000</div></div>
        </aside>
      </section>
      <p className="text-sm text-slate-500">Al guardar, esta plantilla se verá de inmediato en una nueva cotización y en el PDF.</p>
      <div className="flex justify-end"><Button type="submit">Guardar y aplicar plantilla</Button></div>
    </form>
  );
}
