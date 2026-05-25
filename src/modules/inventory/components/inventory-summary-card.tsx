import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

type InventorySummaryCardProps = {
  href: string;
  label: string;
  value: number;
};

export function InventorySummaryCard({
  href,
  label,
  value,
}: InventorySummaryCardProps) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <Link
        className={buttonVariants({ className: "mt-4", size: "sm", variant: "outline" })}
        href={href}
      >
        Ver
      </Link>
    </div>
  );
}
