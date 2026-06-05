import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";

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
    <PageHeader
      actions={headerActions}
      description={description}
      eyebrow={eyebrow}
      title={title}
      titleClassName={titleClassName}
    />
  );
}
