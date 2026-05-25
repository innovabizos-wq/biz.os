import Link from "next/link";

type AgendaStatCardProps = {
  accent: "blue" | "green" | "red" | "violet";
  count: number;
  description: string;
  href: string;
  title: string;
};

const accents: Record<AgendaStatCardProps["accent"], string> = {
  blue: "from-sky-50 to-blue-50 text-sky-700 ring-sky-100",
  green: "from-emerald-50 to-teal-50 text-emerald-700 ring-emerald-100",
  red: "from-rose-50 to-red-50 text-rose-700 ring-rose-100",
  violet: "from-violet-50 to-indigo-50 text-violet-700 ring-violet-100",
};

export function AgendaStatCard({
  accent,
  count,
  description,
  href,
  title,
}: AgendaStatCardProps) {
  return (
    <Link
      className={`rounded-2xl bg-gradient-to-br p-5 shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md ${accents[accent]}`}
      href={href}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{count}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </Link>
  );
}
