import type { Metadata } from "next";
import "./globals.css";

import { KpiThemeProvider } from "@/components/kpi/kpi-theme-provider";

export const metadata: Metadata = {
  title: "biz.os",
  description: "Sistema operativo empresarial SaaS multiempresa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var a=['original','mix','red','green','cyan','purple','pink','black','revenue-noir','analytics-blue','product-radical','negocio-formal','pastel-brisa','pastel-celeste','pastel-rosado','neon','laguna-solar','coral-ejecutivo','oliva-crema','jardin-pop','mono-pop','candy-tech','primario-enfoque'];var t=localStorage.getItem('biz-os-kpi-theme')||'original';t=a.indexOf(t)>-1?t:'original';var c=a.map(function(x){return 'theme-'+x});document.documentElement.dataset.kpiTheme=t;document.documentElement.classList.remove.apply(document.documentElement,c);document.documentElement.classList.add('theme-'+t);document.addEventListener('DOMContentLoaded',function(){document.body.dataset.kpiTheme=t;document.body.classList.remove.apply(document.body,c);document.body.classList.add('theme-'+t)})}catch(e){document.documentElement.dataset.kpiTheme='original';document.documentElement.classList.add('theme-original')}",
          }}
        />
        <KpiThemeProvider />
        {children}
      </body>
    </html>
  );
}
