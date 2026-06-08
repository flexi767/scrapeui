"use client";

import { type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ListingThumbPreview } from "@/components/ListingThumbPreview";
import ListingSearchPrefillButton from "@/components/ListingSearchPrefillButton";
import { getListingThumbAlt, getListingThumbSrc } from "@/lib/listing-thumb";
import { type OwnListingRow } from "@/lib/queries";
import { CARS_BG_TITLE_MAX_LENGTH } from "@/lib/cars-bg/title";
import { OwnListingPublishButtons } from "./OwnListingPublishButtons";
import { SyncStateButton, stopEditorPointerPropagation } from "./TableControls";
import { type OwnListingEditForm } from "./editing";

type EditorKeyDownHandler = (
  e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>,
) => void;

interface OwnListingActionCellProps {
  row: OwnListingRow;
  editing: boolean;
  saving: boolean;
  syncing: boolean;
  publishingToFb: boolean;
  onStartEdit: (row: OwnListingRow) => void;
  onSave: (options?: { closeAfterSave?: boolean; formSnapshot?: OwnListingEditForm }) => void;
  onSync: (row: OwnListingRow) => void;
  onPublishToFacebook: (row: OwnListingRow) => void;
}

export function OwnListingActionCell({
  row,
  editing,
  saving,
  syncing,
  publishingToFb,
  onStartEdit,
  onSave,
  onSync,
  onPublishToFacebook,
}: OwnListingActionCellProps) {
  const t = useTranslations('ui');
  const thumbSrc = getListingThumbSrc(row, { preferListingImage: true });
  const thumbAlt = getListingThumbAlt(row);

  return (
    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-2">
        <div className="flex flex-row items-start gap-1">
          <OwnListingPublishButtons
            publishingToFb={publishingToFb}
            row={row}
            onPublishToFacebook={onPublishToFacebook}
          />
          <div className="flex flex-col items-center gap-1">
            <SyncStateButton
              row={row}
              syncing={syncing}
              onSync={() => onSync(row)}
            />
            {editing ? (
              <button
                onClick={() => onSave({ closeAfterSave: true })}
                disabled={saving}
                title={t('save')}
                className="text-green-400 hover:text-green-300 disabled:opacity-50 text-base leading-none"
              >
                ✓
              </button>
            ) : (
              <button
                onClick={() => onStartEdit(row)}
                disabled={saving}
                title={t('edit')}
                className={`text-gray-400 hover:text-white text-base leading-none ${saving ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
              >
                ✎
              </button>
            )}
          </div>
        </div>
        <ListingSearchPrefillButton listingId={row.id} />
        <ListingThumbPreview
          src={thumbSrc}
          alt={thumbAlt}
          previewAlt={`${thumbAlt} preview`}
          placeholderClassName="h-12 w-16 rounded bg-gray-700"
        />
      </div>
    </td>
  );
}

interface OwnListingTitleCellProps {
  row: OwnListingRow;
  editing: boolean;
  editForm: OwnListingEditForm;
  onEditFormChange: (form: OwnListingEditForm) => void;
  onEditorKeyDown: EditorKeyDownHandler;
}

export function OwnListingTitleCell({
  row,
  editing,
  editForm,
  onEditFormChange,
  onEditorKeyDown,
}: OwnListingTitleCellProps) {
  const t = useTranslations('ui');

  return (
    <td className="px-2 py-1.5 max-w-[200px]">
      {editing ? (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={editForm.title}
            onChange={(e) =>
              onEditFormChange({ ...editForm, title: e.target.value })
            }
            onClick={stopEditorPointerPropagation}
            onMouseDown={stopEditorPointerPropagation}
            onPointerDown={stopEditorPointerPropagation}
            onKeyDown={onEditorKeyDown}
            className="min-h-12 w-full rounded border border-gray-500 bg-gray-700 px-2 py-1 text-xs leading-5 text-white resize-y"
          />
          <input
            type="text"
            maxLength={CARS_BG_TITLE_MAX_LENGTH}
            value={editForm.carsbg_title}
            onChange={(e) =>
              onEditFormChange({
                ...editForm,
                carsbg_title: e.target.value.slice(0, CARS_BG_TITLE_MAX_LENGTH),
              })
            }
            onClick={stopEditorPointerPropagation}
            onMouseDown={stopEditorPointerPropagation}
            onPointerDown={stopEditorPointerPropagation}
            onKeyDown={onEditorKeyDown}
            placeholder={t('carsbg_title_placeholder')}
            className="w-full rounded border border-gray-500 bg-gray-700 px-2 py-1 text-xs leading-5 text-white"
          />
        </div>
      ) : (
        <div>
          <span className="block whitespace-normal break-words text-xs text-gray-400">
            {row.title}
          </span>
          {row.carsbg_title && (
            <span className="mt-1 block whitespace-normal break-words text-[11px] text-gray-500">
              {row.carsbg_title}
            </span>
          )}
        </div>
      )}
    </td>
  );
}
