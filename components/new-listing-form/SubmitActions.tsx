export function SubmitActions({
  saving,
  selectedBackupId,
  onSave,
  onSaveNew,
  onReset,
}: {
  saving: boolean;
  selectedBackupId: number | null;
  onSave: () => void;
  onSaveNew: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onSave}
        disabled={saving}
        className="rounded-full bg-sky-500 px-6 py-2.5 text-sm font-semibold text-gray-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving
          ? "Запазване..."
          : selectedBackupId
            ? "Запази промените"
            : "Запази обявата"}
      </button>
      {selectedBackupId ? (
        <button
          onClick={onSaveNew}
          disabled={saving}
          className="rounded-full border border-sky-500/60 px-6 py-2.5 text-sm font-semibold text-sky-200 transition hover:border-sky-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Запази нова обява
        </button>
      ) : null}
      <button onClick={onReset} className="text-sm text-gray-400 hover:text-white">
        Изчисти
      </button>
    </div>
  );
}
