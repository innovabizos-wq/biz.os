import {
  createAutoblogArticleAction,
  updateAutoblogArticleAction,
} from "@/modules/autoblog/actions";
import {
  AUTOBLOG_SOURCE_MODE_LABELS,
  AUTOBLOG_SOURCE_MODES,
} from "@/modules/autoblog/constants";
import type {
  AutoblogArticle,
  AutoblogSourceMode,
} from "@/modules/autoblog/types";
import { Button } from "@/components/ui/button";

type AutoblogArticleFormProps = {
  article?: AutoblogArticle;
  canEdit: boolean;
  defaultSourceMode?: AutoblogSourceMode;
  mode: "create" | "update";
};

function sourceUrlsText(article?: AutoblogArticle) {
  return article?.sourceUrls.join("\n") ?? "";
}

export function AutoblogArticleForm({
  article,
  canEdit,
  defaultSourceMode = "manual",
  mode,
}: AutoblogArticleFormProps) {
  const action =
    mode === "create" ? createAutoblogArticleAction : updateAutoblogArticleAction;

  return (
    <form action={action} className="space-y-5 rounded-lg border bg-background p-5">
      {article ? <input name="articleId" type="hidden" value={article.id} /> : null}
      <fieldset className="space-y-5" disabled={!canEdit}>
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Titulo</span>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              defaultValue={article?.title ?? ""}
              name="title"
              required
              spellCheck
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Tema</span>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              defaultValue={article?.topic ?? ""}
              name="topic"
              spellCheck
            />
          </label>
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Contenido</span>
          <textarea
            className="min-h-96 w-full rounded-md border bg-background px-3 py-3 text-sm leading-6"
            defaultValue={article?.content ?? ""}
            name="content"
            placeholder="Escribe aqui el articulo. Puedes guardar como borrador y volver a editarlo."
            spellCheck
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Resumen corto</span>
          <textarea
            className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
            defaultValue={article?.summary ?? ""}
            name="summary"
            placeholder="Una idea clara para mostrar en listados o compartir."
            spellCheck
          />
        </label>

        <details className="rounded-lg border bg-muted/20 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Origen y fuentes
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Modo</span>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              defaultValue={article?.sourceMode ?? defaultSourceMode}
              name="sourceMode"
            >
              {AUTOBLOG_SOURCE_MODES.map((modeOption) => (
                <option key={modeOption} value={modeOption}>
                  {AUTOBLOG_SOURCE_MODE_LABELS[modeOption]}
                </option>
              ))}
            </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">URLs de fuente</span>
              <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue={sourceUrlsText(article)}
                name="sourceUrlsText"
                placeholder="Una URL por linea"
                spellCheck={false}
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium">Notas de fuente</span>
              <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue={article?.sourceNotes ?? ""}
                name="sourceNotes"
                spellCheck
              />
            </label>
          </div>
        </details>

        <details className="rounded-lg border bg-muted/20 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            SEO y palabras clave
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">SEO title</span>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue={article?.seoTitle ?? ""}
                name="seoTitle"
                spellCheck
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">SEO description</span>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue={article?.seoDescription ?? ""}
                name="seoDescription"
                spellCheck
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium">Keywords</span>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue={article?.keywords ?? ""}
                name="keywords"
                spellCheck
              />
            </label>
          </div>
        </details>

        <details className="rounded-lg border bg-muted/20 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Copys para redes
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Facebook</span>
              <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue={article?.socialFacebook ?? ""}
                name="socialFacebook"
                spellCheck
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Instagram</span>
              <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue={article?.socialInstagram ?? ""}
                name="socialInstagram"
                spellCheck
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">LinkedIn</span>
              <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue={article?.socialLinkedin ?? ""}
                name="socialLinkedin"
                spellCheck
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">WhatsApp</span>
              <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue={article?.socialWhatsapp ?? ""}
                name="socialWhatsapp"
                spellCheck
              />
            </label>
          </div>
        </details>

        <label className="space-y-1 text-sm">
          <span className="font-medium">CTA</span>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={article?.cta ?? ""}
            name="cta"
            spellCheck
          />
        </label>
      </fieldset>

      <div className="flex justify-end">
        <Button disabled={!canEdit} type="submit">
          {mode === "create" ? "Guardar borrador" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
