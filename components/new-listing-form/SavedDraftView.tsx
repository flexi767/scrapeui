import Link from "next/link";
import { BackupImageManager } from "@/components/new-listing-form/BackupImageManager";
import { SavedListingSummary } from "@/components/new-listing-form/ui";
import type { FormState } from "@/components/new-listing-form/constants";

export function SavedDraftView({
  form,
  mode,
  backupId,
  onEditDetails,
  onNewListing,
}: {
  form: FormState;
  mode: "created" | "updated";
  backupId: number | null;
  onEditDetails: () => void;
  onNewListing: () => void;
}) {
  return (
    <div className="space-y-5 pb-8">
      <SavedListingSummary
        form={form}
        mode={mode}
        onEditDetails={onEditDetails}
        onNewListing={onNewListing}
      />
      {backupId ? (
        <>
          <BackupImageManager backupId={backupId} />
          <div className="flex items-center gap-4 text-sm">
            <Link
              href={`/mobilebg/backups/${backupId}`}
              className="text-sky-300 underline hover:text-sky-200"
            >
              Отвори черновата
            </Link>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-300">
          Черновата е запазена, но липсва backup ID за зареждане на снимки.
        </div>
      )}
    </div>
  );
}
