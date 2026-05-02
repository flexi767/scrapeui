import { Loader2 } from "lucide-react";

export function SavedSearchLoadingState() {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-12 text-center text-sm text-gray-400">
      <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
      Loading saved search…
    </div>
  );
}

export function SavedSearchEmptyState() {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-12 text-center text-sm text-gray-500">
      Select a saved search to edit it.
    </div>
  );
}
