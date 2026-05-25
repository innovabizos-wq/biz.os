import type { ReactNode } from "react";

type InfoItem = {
  label: string;
  mono?: boolean;
  value: ReactNode;
};

type InfoCardProps = {
  description?: string;
  items: InfoItem[];
  title: string;
};

export function InfoCard({ description, items, title }: InfoCardProps) {
  return (
    <section className="rounded-lg border bg-background p-5 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div className="space-y-1" key={item.label}>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              {item.label}
            </dt>
            <dd
              className={
                item.mono
                  ? "break-all font-mono text-sm"
                  : "break-words text-sm font-medium"
              }
            >
              {item.value || "No disponible"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
