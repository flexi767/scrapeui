export function SavedSearchFieldHeader({
  name,
  label,
  stepperDelta,
  showClear = false,
  showCode = true,
  onClear,
  onNudge,
}: {
  name: string;
  label: string;
  stepperDelta: number | null;
  showClear?: boolean;
  showCode?: boolean;
  onClear: (name: string) => void;
  onNudge: (name: string, delta: number) => void;
}) {
  return (
    <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
      <div className="truncate text-xs font-medium text-gray-300">{label}</div>
      {stepperDelta != null ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="h-5 rounded border border-gray-600 px-1.5 text-[10px] leading-none text-gray-300 hover:bg-gray-700"
            onClick={() => onNudge(name, -stepperDelta)}
            aria-label={`Decrease ${label}`}
          >
            -{stepperDelta}
          </button>
          <button
            type="button"
            className="h-5 rounded border border-gray-600 px-1.5 text-[10px] leading-none text-gray-300 hover:bg-gray-700"
            onClick={() => onNudge(name, stepperDelta)}
            aria-label={`Increase ${label}`}
          >
            +{stepperDelta}
          </button>
        </div>
      ) : showClear ? (
        <button
          type="button"
          className="h-5 rounded border border-gray-600 px-1.5 text-[10px] leading-none text-gray-300 hover:bg-gray-700"
          onClick={() => onClear(name)}
        >
          Clear
        </button>
      ) : showCode ? (
        <div className="shrink-0 text-[10px] uppercase tracking-wide text-gray-500">
          {name}
        </div>
      ) : null}
    </div>
  );
}
