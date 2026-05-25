import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

type AgendaSummaryCardProps = {
  count: number;
  description: string;
  href?: string;
  title: string;
};

export function AgendaSummaryCard({
  count,
  description,
  href,
  title,
}: AgendaSummaryCardProps) {
  return (
    <article className="rounded-lg border bg-background p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold">{count}</p>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {href ? (
          <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={href}>
            Ver
          </Link>
        ) : null}
      </div>
    </article>
  );
}
