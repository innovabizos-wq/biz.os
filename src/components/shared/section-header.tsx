import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  action?: ReactNode;
  actions?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
  titleClassName?: string;
};

export function SectionHeader({
  action,
  actions,
  description,
  eyebrow,
  title,
  titleClassName,
}: SectionHeaderProps) {
  const headerActions = actions ?? action;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="app-page-eyebrow">{eyebrow}</p> : null}
        <h2 className={cn("app-page-title", titleClassName)}>{title}</h2>
        {description ? (
          <p className="app-page-description">{description}</p>
        ) : null}
      </div>
      {headerActions ? <div className="shrink-0 pt-1">{headerActions}</div> : null}
    </div>
  );
}
