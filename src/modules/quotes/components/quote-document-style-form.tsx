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
                <span className={cn(
                  "block h-20 p-3",
                  item.code === "executive" && "bg-slate-900",
                  item.code === "bold" && "bg-emerald-700",
                  item.code === "minimal" && "bg-slate-100",
                  item.code === "editorial" && "bg-violet-900",
                  item.code === "classic" && "bg-stone-700",
                )}>
                  <span className={cn(
                    "block text-[10px] font-bold uppercase tracking-[0.18em]",
                    item.code === "minimal" ? "text-slate-500" : "text-white/70",
                  )}>Proforma</span>
                  <span className={cn(
                    "mt-2 block text-xl font-black",
                    item.code === "minimal" ? "text-slate-900" : "text-white",
                  )}>000123</span>
                </span>
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
      <div className="flex justify-end"><Button type="submit">Guardar diseño de proformas</Button></div>
    </form>
  );
}
