'use client';

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DealerListingSummary } from "@/components/new-listing-form/dealer-picker";

export function DraftDeleteDialog({
  candidate,
  deletingBackupId,
  onOpenChange,
  onCancel,
  onConfirm,
}: {
  candidate: DealerListingSummary | null;
  deletingBackupId: number | null;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: (backupId: number) => void;
}) {
  const t = useTranslations('ui');
  const listingTitle = candidate
    ? [candidate.make, candidate.model].filter(Boolean).join(" ") || t('this_listing')
    : t('this_listing');

  return (
    <Dialog open={Boolean(candidate)} onOpenChange={onOpenChange}>
      <DialogContent className="border border-gray-700 bg-gray-900 text-gray-100">
        <DialogHeader>
          <DialogTitle>{t('delete_draft')}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('delete_draft_for', { title: listingTitle })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            disabled={deletingBackupId != null}
            className="rounded-md border border-gray-600 bg-transparent px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (candidate?.backupId) onConfirm(candidate.backupId);
            }}
            disabled={deletingBackupId != null || !candidate}
            className="rounded-md border border-red-700 bg-red-950/80 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deletingBackupId != null ? t('deleting') : t('delete')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
