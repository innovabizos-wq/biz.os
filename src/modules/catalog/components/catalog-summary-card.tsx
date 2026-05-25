type CatalogSummaryCardProps = {
  label: string;
  value: number;
};

export function CatalogSummaryCard({ label, value }: CatalogSummaryCardProps) {
  return (
    <article className="rounded-lg border bg-background p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </article>
  );
}
