const filters = ["Todas", "No leidas", "Asignadas", "WhatsApp"] as const;

export function WidgetFilters() {
  return (
    <div className="flex gap-2 overflow-x-auto px-3 py-3">
      {filters.map((filter, index) => (
        <button
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            index === 0
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-600"
          }`}
          key={filter}
          type="button"
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
