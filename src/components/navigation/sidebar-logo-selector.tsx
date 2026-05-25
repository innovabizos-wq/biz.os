"use client";

import { ImageUp, RotateCcw } from "lucide-react";
import type { ChangeEvent } from "react";
import { useMemo, useSyncExternalStore, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getServerSidebarLogoSnapshot,
  getSidebarLogoSnapshot,
  parseSidebarLogoSnapshot,
  resetSidebarLogo,
  saveSidebarLogo,
  subscribeToSidebarLogoChanges,
} from "@/components/navigation/sidebar-brand-logo";

export function SidebarLogoSelector() {
  const snapshot = useSyncExternalStore(
    subscribeToSidebarLogoChanges,
    getSidebarLogoSnapshot,
    getServerSidebarLogoSnapshot,
  );
  const logo = useMemo(() => parseSidebarLogoSnapshot(snapshot), [snapshot]);
  const [name, setName] = useState(logo.name);
  const [subtitle, setSubtitle] = useState(logo.subtitle);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        saveSidebarLogo({
          name: name.trim() || "biz.os",
          src: reader.result,
          subtitle: subtitle.trim() || "Nucleo empresarial",
        });
      }
    };
    reader.readAsDataURL(file);
  }

  function handleNameBlur() {
    saveSidebarLogo({
      name: name.trim() || "biz.os",
      src: logo.src,
      subtitle: subtitle.trim() || "Nucleo empresarial",
    });
  }

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="app-sidebar-brand app-sidebar-brand-preview">
          <div className="app-sidebar-logo-frame">
            {logo.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={logo.name} className="app-sidebar-logo-image" src={logo.src} />
            ) : (
              <div className="app-sidebar-logo-fallback">{logo.name}</div>
            )}
          </div>
          <p className="app-sidebar-brand-caption">{logo.subtitle}</p>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Nombre alternativo</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              onBlur={handleNameBlur}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Subtitulo</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              onBlur={handleNameBlur}
              onChange={(event) => setSubtitle(event.target.value)}
              value={subtitle}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted">
              <ImageUp size={16} />
              Cambiar logo rectangular
              <input
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={handleFileChange}
                type="file"
              />
            </label>
            <Button onClick={resetSidebarLogo} type="button" variant="outline">
              <RotateCcw size={16} />
              Restablecer
            </Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Usa una imagen horizontal para aprovechar mejor el espacio superior del menu.
          </p>
        </div>
      </div>
    </div>
  );
}
