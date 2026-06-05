import { saveBusinessContextAction } from "@/modules/business-context/actions";
import type { BusinessContext } from "@/modules/business-context/types";
import { Button } from "@/components/ui/button";

type BusinessContextFormProps = {
  canManage: boolean;
  context: BusinessContext | null;
};

type FieldName = keyof Pick<
  BusinessContext,
  | "aiInstructions"
  | "brandPersonality"
  | "businessHours"
  | "businessSummary"
  | "competitors"
  | "coreValues"
  | "customerPainPoints"
  | "customerServiceRules"
  | "differentiators"
  | "forbiddenTopics"
  | "geographicScope"
  | "keywords"
  | "mainOffers"
  | "mission"
  | "notes"
  | "operationalRules"
  | "preferredCta"
  | "pricingNotes"
  | "productsServices"
  | "requiredDisclaimers"
  | "salesRules"
  | "serviceAreas"
  | "serviceProcess"
  | "targetAudience"
  | "toneOfVoice"
  | "vision"
>;

type FieldConfig = {
  help?: string;
  label: string;
  name: FieldName;
  rows?: number;
};

type SectionConfig = {
  description: string;
  fields: FieldConfig[];
  title: string;
};

const sections: SectionConfig[] = [
  {
    description: "Identidad, proposito y forma de expresarse.",
    fields: [
      {
        help: "Explica que hace la empresa, para quien y por que importa.",
        label: "Resumen del negocio",
        name: "businessSummary",
      },
      { label: "Mision", name: "mission" },
      { label: "Vision", name: "vision" },
      { label: "Valores", name: "coreValues" },
      { label: "Personalidad de marca", name: "brandPersonality" },
      { label: "Tono de comunicacion", name: "toneOfVoice" },
    ],
    title: "Identidad",
  },
  {
    description: "Clientes, mercado y posicionamiento competitivo.",
    fields: [
      { label: "Publico objetivo", name: "targetAudience" },
      {
        help: "Describe necesidades, objeciones y problemas frecuentes.",
        label: "Dolores/necesidades del cliente",
        name: "customerPainPoints",
      },
      { label: "Zona geografica", name: "geographicScope" },
      { label: "Competidores", name: "competitors" },
      { label: "Diferenciadores", name: "differentiators" },
    ],
    title: "Mercado",
  },
  {
    description: "Lo que vendes y como lo entregas.",
    fields: [
      { label: "Productos y servicios", name: "productsServices" },
      { label: "Ofertas principales", name: "mainOffers" },
      { label: "Notas de precios", name: "pricingNotes" },
      { label: "Proceso de servicio", name: "serviceProcess" },
    ],
    title: "Oferta",
  },
  {
    description: "Reglas internas que deben respetar las respuestas y automatizaciones.",
    fields: [
      { label: "Horarios", name: "businessHours" },
      { label: "Zonas de cobertura", name: "serviceAreas" },
      { label: "Reglas operativas", name: "operationalRules" },
      { label: "Reglas comerciales", name: "salesRules" },
      { label: "Reglas de atencion al cliente", name: "customerServiceRules" },
    ],
    title: "Operacion",
  },
  {
    description: "Instrucciones para contenido, IA y futuras automatizaciones.",
    fields: [
      { label: "CTA preferido", name: "preferredCta" },
      { label: "Palabras clave", name: "keywords" },
      {
        help: "Temas que biz.os no debe usar para contenido o respuestas.",
        label: "Temas prohibidos",
        name: "forbiddenTopics",
      },
      { label: "Disclaimers obligatorios", name: "requiredDisclaimers" },
      {
        help: "Instrucciones generales que debe respetar cualquier modulo inteligente.",
        label: "Instrucciones para IA",
        name: "aiInstructions",
      },
    ],
    title: "IA y contenido",
  },
  {
    description: "Informacion interna que ayuda a interpretar el negocio.",
    fields: [{ label: "Notas internas", name: "notes", rows: 6 }],
    title: "Notas internas",
  },
];

export function BusinessContextForm({
  canManage,
  context,
}: BusinessContextFormProps) {
  return (
    <form action={saveBusinessContextAction} className="space-y-5">
      <fieldset className="space-y-5" disabled={!canManage}>
        {sections.map((section) => (
          <section
            className="rounded-lg border bg-background p-5"
            key={section.title}
          >
            <div className="mb-4">
              <h2 className="text-base font-semibold">{section.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {section.description}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {section.fields.map((field) => (
                <label
                  className={
                    field.name === "notes"
                      ? "space-y-1 text-sm md:col-span-2"
                      : "space-y-1 text-sm"
                  }
                  key={field.name}
                >
                  <span className="font-medium">{field.label}</span>
                  <textarea
                    className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    defaultValue={context?.[field.name] ?? ""}
                    name={field.name}
                    rows={field.rows ?? 4}
                  />
                  {field.help ? (
                    <span className="block text-xs text-muted-foreground">
                      {field.help}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </section>
        ))}
      </fieldset>
      <div className="flex justify-end">
        <Button disabled={!canManage} type="submit">
          Guardar contexto
        </Button>
      </div>
    </form>
  );
}
