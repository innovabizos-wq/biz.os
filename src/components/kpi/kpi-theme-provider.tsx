"use client";

import { useEffect } from "react";

export const KPI_THEME_STORAGE_KEY = "biz-os-kpi-theme";
const DEFAULT_KPI_THEME = "original";

export const KPI_THEME_VALUES = [
  "original",
  "mix",
  "red",
  "green",
  "cyan",
  "purple",
  "pink",
  "black",
  "revenue-noir",
  "analytics-blue",
  "product-radical",
  "negocio-formal",
  "pastel-brisa",
  "pastel-celeste",
  "pastel-rosado",
  "neon",
  "laguna-solar",
  "coral-ejecutivo",
  "oliva-crema",
  "jardin-pop",
  "mono-pop",
  "candy-tech",
  "primario-enfoque",
] as const;

export const KPI_THEMES = [
  {
    description: "Negro, verde, rojo y amarillo.",
    label: "Original",
    value: "original",
  },
  {
    description: "Morado, celeste, verde y naranja.",
    label: "Mixta premium",
    value: "mix",
  },
  {
    description: "Variaciones intensas de rojo.",
    label: "Rojo",
    value: "red",
  },
  {
    description: "Variaciones profundas de verde.",
    label: "Verde",
    value: "green",
  },
  {
    description: "Variaciones frescas de celeste.",
    label: "Celeste",
    value: "cyan",
  },
  {
    description: "Variaciones fuertes de morado.",
    label: "Morado",
    value: "purple",
  },
  {
    description: "Variaciones premium de rosado.",
    label: "Rosado",
    value: "pink",
  },
  {
    description: "Negro, grafito y contrastes sobrios.",
    label: "Negro",
    value: "black",
  },
  {
    description: "Dashboard financiero oscuro con blanco, naranja y amarillo.",
    label: "Infografia noir",
    value: "revenue-noir",
  },
  {
    description: "Paneles KPI negros con azul analitico, barras y lineas finas.",
    label: "Analitica azul",
    value: "analytics-blue",
  },
  {
    description: "Sistema moderno radical con laminas claras, negro, amarillo y purpura.",
    label: "Producto radical",
    value: "product-radical",
  },
  {
    description: "Paleta seria de negocio, plana y sin sombras.",
    label: "Negocio formal",
    value: "negocio-formal",
  },
  {
    description: "Celeste, aqua, vainilla y lila suave.",
    label: "Pastel Brisa",
    value: "pastel-brisa",
  },
  {
    description: "Celeste claro, hielo, aqua y azul suave.",
    label: "Celeste pastel",
    value: "pastel-celeste",
  },
  {
    description: "Rosado suave, blush, malva y cereza pastel.",
    label: "Rosado pastel",
    value: "pastel-rosado",
  },
  {
    description: "Neon electrico con alto impacto visual.",
    label: "Neon",
    value: "neon",
  },
  {
    description: "Aqua, gris, teal y amarillo solar.",
    label: "Laguna solar",
    value: "laguna-solar",
  },
  {
    description: "Azul marino, coral, ambar y cyan.",
    label: "Coral ejecutivo",
    value: "coral-ejecutivo",
  },
  {
    description: "Verdes oliva, crema y amarillo calido.",
    label: "Oliva crema",
    value: "oliva-crema",
  },
  {
    description: "Rosado, lima, menta y verde profundo.",
    label: "Jardin pop",
    value: "jardin-pop",
  },
  {
    description: "Negro, blanco, magenta, teal y gris.",
    label: "Mono pop",
    value: "mono-pop",
  },
  {
    description: "Cyan fresco con rosas intensos.",
    label: "Candy tech",
    value: "candy-tech",
  },
  {
    description: "Azul, verde, amarillo y rojo de alto enfoque.",
    label: "Primario enfoque",
    value: "primario-enfoque",
  },
] as const;

export type KpiThemeValue = (typeof KPI_THEME_VALUES)[number];

export function isKpiThemeValue(value: string | null): value is KpiThemeValue {
  return KPI_THEME_VALUES.some((themeValue) => themeValue === value);
}

export function normalizeKpiTheme(value: string | null): KpiThemeValue {
  return isKpiThemeValue(value) ? value : DEFAULT_KPI_THEME;
}

function setKpiThemeDataset(value: KpiThemeValue) {
  const themeClasses = KPI_THEME_VALUES.map((themeValue) => `theme-${themeValue}`);
  const targetClass = `theme-${value}`;

  document.documentElement.dataset.kpiTheme = value;
  document.documentElement.classList.remove(...themeClasses);
  document.documentElement.classList.add(targetClass);

  if (document.body) {
    document.body.dataset.kpiTheme = value;
    document.body.classList.remove(...themeClasses);
    document.body.classList.add(targetClass);
  }
}

export function applyKpiTheme(value: KpiThemeValue) {
  setKpiThemeDataset(value);
  window.localStorage.setItem(KPI_THEME_STORAGE_KEY, value);
}

export function KpiThemeProvider() {
  useEffect(() => {
    const storedTheme = window.localStorage.getItem(KPI_THEME_STORAGE_KEY);
    setKpiThemeDataset(normalizeKpiTheme(storedTheme));
  }, []);

  return null;
}
