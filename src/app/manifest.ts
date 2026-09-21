import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#ffffff",
    description: "Operación empresarial, ventas y punto de venta de Biz.OS.",
    display: "standalone",
    icons: [
      { purpose: "any", sizes: "any", src: "/icons/bizos.svg", type: "image/svg+xml" },
      { purpose: "maskable", sizes: "any", src: "/icons/bizos.svg", type: "image/svg+xml" },
    ],
    id: "/ventas/pos",
    lang: "es-CR",
    name: "Biz.OS",
    orientation: "any",
    scope: "/",
    short_name: "Biz.OS",
    start_url: "/ventas/pos",
    theme_color: "#111827",
  };
}
