import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  actions?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
  titleClassName?: string;
};

export function PageHeader({
  actions,
  description,
  eyebrow,
  title,
  titleClassName,
}: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="app-page-eyebrow">{eyebrow}</p> : null}
        <h1 className={cn("app-page-title", titleClassName)}>{title}</h1>
        {description ? <p className="app-page-description">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0 pt-1">{actions}</div> : null}
    </header>
  );
}
