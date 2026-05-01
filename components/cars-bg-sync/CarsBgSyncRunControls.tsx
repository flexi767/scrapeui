interface CarsBgSyncRunControlsProps {
  running: boolean;
  stopping: boolean;
  currentDealer: string | null;
  onPreview: () => void;
  onRunLive: () => void;
}

export function CarsBgSyncRunControls({
  running,
  stopping,
  currentDealer,
  onPreview,
  onRunLive,
}: CarsBgSyncRunControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        onClick={onPreview}
        disabled={stopping}
        className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          running ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
        }`}
      >
        {(running || stopping) && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {stopping ? 'Stopping…' : running ? 'Stop' : 'Preview plan'}
      </button>

      <button
        onClick={onRunLive}
        disabled={running}
        className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Run live
      </button>

      {currentDealer && (
        <div className="min-w-0 flex-1 rounded-lg border border-sky-700/40 bg-sky-950/30 px-3 py-2 text-sm text-sky-200">
          <div className="text-[11px] uppercase tracking-wide text-sky-300/70">Current dealer</div>
          <div className="mt-1 truncate">{currentDealer}</div>
        </div>
      )}
    </div>
  );
}
