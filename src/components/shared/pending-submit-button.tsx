"use client";

import { useFormStatus } from "react-dom";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";

type PendingSubmitButtonProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  icon?: ComponentType<{ "aria-hidden"?: boolean; size?: number }>;
  name?: string;
  pendingLabel: string;
  size?: "default" | "sm" | "lg" | "icon";
  title?: string;
  value?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
};

export function PendingSubmitButton({
  children,
  className,
  disabled = false,
  icon: Icon,
  name,
  pendingLabel,
  size,
  title,
  value,
  variant,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      className={className}
      disabled={disabled || pending}
      name={name}
      size={size}
      title={title}
      type="submit"
      value={value}
      variant={variant}
    >
      {Icon ? <Icon aria-hidden={true} /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}
