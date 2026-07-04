import type { ReactNode } from "react";

type PlatformCardProps = {
  children: ReactNode;
  className?: string;
};

type PlatformBadgeTone = "blue" | "green" | "amber" | "red" | "slate";

const badgeToneClasses: Record<PlatformBadgeTone, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  red: "border-rose-200 bg-rose-50 text-rose-800",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

export function PlatformCard({ children, className = "" }: PlatformCardProps) {
  return (
    <section
      className={`rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-100/60 ${className}`}
    >
      {children}
    </section>
  );
}

export function PlatformBadge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: PlatformBadgeTone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${badgeToneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export function statusTone(value: string | null | undefined): PlatformBadgeTone {
  const normalized = value?.toLowerCase() ?? "";

  if (["activa", "activo", "healthy", "ok", "active", "connected"].includes(normalized)) {
    return "green";
  }

  if (
    ["pendiente", "pending", "warning", "misconfigured", "issues", "incompleto"].includes(
      normalized,
    )
  ) {
    return "amber";
  }

  if (["error", "unhealthy", "suspendida", "inactive", "inactiva"].includes(normalized)) {
    return "red";
  }

  return "slate";
}

export function PlatformSectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  action?: ReactNode;
  description?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-black text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

