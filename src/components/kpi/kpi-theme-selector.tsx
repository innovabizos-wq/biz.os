"use client";

import { useSyncExternalStore } from "react";

import {
  applyKpiTheme,
  KPI_THEME_STORAGE_KEY,
  KPI_THEMES,
  normalizeKpiTheme,
  type KpiThemeValue,
} from "@/components/kpi/kpi-theme-provider";

const themePreviewColors: Record<KpiThemeValue, [string, string, string][]> = {
  original: [
    ["#1f2937", "#0f172a", "#020617"],
    ["#22c55e", "#15803d", "#052e16"],
    ["#ef4444", "#b91c1c", "#450a0a"],
    ["#fbbf24", "#b45309", "#451a03"],
  ],
  mix: [
    ["#8b5cf6", "#5b21b6", "#1e0b3f"],
    ["#0ea5e9", "#075985", "#061826"],
    ["#22c55e", "#166534", "#04170a"],
    ["#fb923c", "#c2410c", "#2a0802"],
  ],
  red: [
    ["#f87171", "#dc2626", "#450a0a"],
    ["#ef4444", "#b91c1c", "#3f0606"],
    ["#dc2626", "#991b1b", "#2f0606"],
    ["#b91c1c", "#7f1d1d", "#210404"],
  ],
  green: [
    ["#4ade80", "#16a34a", "#052e16"],
    ["#22c55e", "#15803d", "#04240f"],
    ["#16a34a", "#166534", "#031b0b"],
    ["#15803d", "#14532d", "#021407"],
  ],
  cyan: [
    ["#22d3ee", "#0891b2", "#083344"],
    ["#06b6d4", "#0e7490", "#072a38"],
    ["#0891b2", "#155e75", "#061f2a"],
    ["#0e7490", "#164e63", "#041923"],
  ],
  purple: [
    ["#c084fc", "#9333ea", "#2e1065"],
    ["#a855f7", "#7e22ce", "#240a52"],
    ["#9333ea", "#6b21a8", "#1b083f"],
    ["#7e22ce", "#581c87", "#16062f"],
  ],
  pink: [
    ["#f9a8d4", "#db2777", "#500724"],
    ["#f472b6", "#be185d", "#3f061d"],
    ["#ec4899", "#9d174d", "#330517"],
    ["#db2777", "#831843", "#26030f"],
  ],
  black: [
    ["#334155", "#111827", "#000000"],
    ["#475569", "#1f2937", "#020617"],
    ["#64748b", "#334155", "#0f172a"],
    ["#94a3b8", "#475569", "#111827"],
  ],
  "revenue-noir": [
    ["#000000", "#1f1f1f", "#000000"],
    ["#ffffff", "#f1f1f1", "#d9d9d9"],
    ["#ff3d00", "#ff8a00", "#ffe12b"],
    ["#2a2a2a", "#111111", "#000000"],
  ],
  "analytics-blue": [
    ["#050607", "#020304", "#000000"],
    ["#0a2f4f", "#195c8b", "#6aa1c9"],
    ["#0b1720", "#0d3b63", "#1d79b8"],
    ["#6f95ad", "#376f98", "#16435f"],
  ],
  "product-radical": [
    ["#f3f2ef", "#ffffff", "#e4e2dc"],
    ["#050505", "#111111", "#000000"],
    ["#ffdf57", "#f0c745", "#caa329"],
    ["#d6a8ff", "#b779f2", "#7c3fc6"],
  ],
  "negocio-formal": [
    ["#ffffff", "#f8fafc", "#e2e8f0"],
    ["#f8fafc", "#eef2f7", "#cbd5e1"],
    ["#f1f5f9", "#e2e8f0", "#94a3b8"],
    ["#e5e7eb", "#d1d5db", "#64748b"],
  ],
  "pastel-brisa": [
    ["#bae6fd", "#38bdf8", "#075985"],
    ["#99f6e4", "#2dd4bf", "#134e4a"],
    ["#fef3c7", "#fbbf24", "#78350f"],
    ["#ddd6fe", "#a78bfa", "#4c1d95"],
  ],
  "pastel-celeste": [
    ["#dff7ff", "#8bdcf5", "#2384b6"],
    ["#c9f3ff", "#67d7ec", "#0f7f98"],
    ["#e8fbff", "#a9e9f7", "#3a9fc4"],
    ["#f5fdff", "#b9e7ff", "#5aa6d6"],
  ],
  "pastel-rosado": [
    ["#ffe4f1", "#f9a8d4", "#be477f"],
    ["#ffe8ee", "#f7b2c4", "#c95f7f"],
    ["#f8d7ff", "#e9a5f5", "#9f4fb0"],
    ["#fff1f6", "#fbcfe8", "#d36b9f"],
  ],
  neon: [
    ["#22d3ee", "#2563eb", "#020617"],
    ["#a3e635", "#16a34a", "#052e16"],
    ["#f0abfc", "#d946ef", "#581c87"],
    ["#fde047", "#f97316", "#431407"],
  ],
  "laguna-solar": [
    ["#82d1ca", "#33a9a5", "#0f766e"],
    ["#c5cbd1", "#94a3b8", "#334155"],
    ["#147a7c", "#0f6f73", "#083f46"],
    ["#ffe500", "#facc15", "#854d0e"],
  ],
  "coral-ejecutivo": [
    ["#1d2d5f", "#172554", "#020617"],
    ["#f65e5d", "#dc2626", "#7f1d1d"],
    ["#ffbc47", "#f59e0b", "#78350f"],
    ["#40cee3", "#0891b2", "#083344"],
  ],
  "oliva-crema": [
    ["#a7c584", "#6f9a4f", "#365314"],
    ["#4b8a47", "#3f7f3f", "#1f4d24"],
    ["#eae3c9", "#c9b66e", "#5f541f"],
    ["#f6c915", "#d9a500", "#713f12"],
  ],
  "jardin-pop": [
    ["#ff3f78", "#e11d5f", "#831843"],
    ["#e0dc3f", "#b8b92e", "#4d5d13"],
    ["#aee5b3", "#68bd73", "#22543d"],
    ["#437f39", "#2f6b2f", "#123b22"],
  ],
  "mono-pop": [
    ["#000000", "#171717", "#000000"],
    ["#ffffff", "#f5f5f5", "#c0c0c0"],
    ["#b00b80", "#8f087f", "#4c0648"],
    ["#008b80", "#057c78", "#083f46"],
  ],
  "candy-tech": [
    ["#51d6ce", "#22c7c3", "#0f766e"],
    ["#48b4bd", "#2395a3", "#115e67"],
    ["#f0447e", "#db2777", "#831843"],
    ["#d3376d", "#be185d", "#701a3c"],
  ],
  "primario-enfoque": [
    ["#1489df", "#0f73c8", "#0b3f83"],
    ["#16975a", "#15803d", "#052e16"],
    ["#ffca20", "#facc15", "#854d0e"],
    ["#ff2a23", "#dc2626", "#7f1d1d"],
  ],
};

function getStoredTheme() {
  const storedTheme = window.localStorage.getItem(KPI_THEME_STORAGE_KEY);

  return normalizeKpiTheme(storedTheme);
}

function subscribeToThemeChanges(onStoreChange: () => void) {
  window.addEventListener("kpi-theme-change", onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener("kpi-theme-change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function KpiThemeSelector() {
  const selectedTheme = useSyncExternalStore(
    subscribeToThemeChanges,
    getStoredTheme,
    () => "original",
  );

  function selectTheme(theme: KpiThemeValue) {
    applyKpiTheme(theme);
    window.dispatchEvent(
      new CustomEvent("kpi-theme-change", {
        detail: { theme },
      }),
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {KPI_THEMES.map((theme) => (
        <button
          aria-pressed={selectedTheme === theme.value}
          className="kpi-theme-option group rounded-xl border bg-background p-4 text-left transition hover:border-foreground/30 hover:bg-muted aria-pressed:bg-muted"
          key={theme.value}
          onClick={() => selectTheme(theme.value)}
          type="button"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{theme.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {theme.description}
              </p>
            </div>
            <span className="mt-1 size-3 rounded-full border bg-foreground opacity-0 transition group-aria-pressed:opacity-100" />
          </div>

          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {themePreviewColors[theme.value].map((colors) => (
              <span
                className="h-9 rounded-lg border border-white/30 shadow-sm"
                key={colors.join("-")}
                style={{
                  background: `radial-gradient(circle at 25% 18%, rgba(255,255,255,0.28), transparent 28%), linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 48%, ${colors[2]} 100%)`,
                }}
              />
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
