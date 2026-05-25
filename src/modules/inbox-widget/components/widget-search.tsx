type WidgetSearchProps = {
  onChange: (value: string) => void;
  value: string;
};

export function WidgetSearch({ onChange, value }: WidgetSearchProps) {
  return (
    <label className="block px-3 pt-3">
      <span className="sr-only">Buscar conversaciones</span>
      <input
        className="h-10 w-full rounded-full border-0 bg-slate-100 px-4 text-sm outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:bg-white focus:ring-emerald-300"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar o iniciar chat"
        value={value}
      />
    </label>
  );
}
