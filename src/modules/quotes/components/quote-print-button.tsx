"use client";

import { Button } from "@/components/ui/button";

export function QuotePrintButton() {
  return (
    <Button onClick={() => window.print()} type="button">
      Imprimir / guardar PDF
    </Button>
  );
}
