"use client";

import { type KeyboardEvent } from "react";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { KaparoBadge, VatBadge } from "@/components/listings/VatBadge";
import { formatDateOnly } from "@/lib/date-format";
import { OwnListingRow } from "@/lib/queries";
import { formatCount, formatDate } from "@/lib/utils";
import { OwnListingAdStatusCell } from "./OwnListingAdStatusCell";
import { OwnListingPriceCell } from "./OwnListingPriceCell";
import { OwnListingActionCell, OwnListingTitleCell } from "./OwnListingTableCells";
import { stopEditorPointerPropagation } from "./TableControls";
import { getOwnListingRowKey, type OwnListingEditForm } from "./editing";
import { CARS_BG_TITLE_MAX_LENGTH } from "@/lib/cars-bg/title";

interface OwnListingTableRowProps {
  row: OwnListingRow;
  editing: boolean;
  editForm: OwnListingEditForm;
  saving: boolean;
  syncing: boolean;
  publishingToFb: boolean;
  /** True when this row's edit was started by clicking the status cell. */
  adStatusAutoOpen: boolean;
  onStartEdit: (row: OwnListingRow, openAdStatus?: boolean) => void;
  onStartPriceEdit: (row: OwnListingRow) => void;
  onEditFormChange: (form: OwnListingEditForm) => void;
  onSave: (options?: {
    closeAfterSave?: boolean;
    formSnapshot?: OwnListingEditForm;
  }) => void;
  onDebouncedPriceSave: (form: OwnListingEditForm) => void;
  onSync: (row: OwnListingRow) => void;
  onPublishToFacebook: (row: OwnListingRow) => void;
  onEditorKeyDown: (
    e: KeyboardEvent<
      HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement
    >,
  ) => void;
}

export function OwnListingTableRow({
  row,
  editing,
  editForm,
  saving,
  syncing,
  publishingToFb,
  adStatusAutoOpen,
  onStartEdit,
  onStartPriceEdit,
  onEditFormChange,
  onSave,
  onDebouncedPriceSave,
  onSync,
  onPublishToFacebook,
  onEditorKeyDown,
}: OwnListingTableRowProps) {
  const t = useTranslations('ui');
  const kmFormatted = formatCount(row.mileage);

  return (
    <tr
      key={getOwnListingRowKey(row)}
      className={`align-middle transition-colors ${
        editing
          ? "bg-gray-800"
          : row.search_checked_at && row.search_original_position == null
            ? "bg-red-950/20 hover:bg-red-950/30"
            : "hover:bg-gray-800/50"
      }`}
      onClick={!editing ? () => onStartEdit(row) : undefined}
      style={{ cursor: editing ? "default" : "pointer" }}
    >
      <OwnListingActionCell
        row={row}
        editing={editing}
        saving={saving}
        syncing={syncing}
        publishingToFb={publishingToFb}
        onStartEdit={onStartEdit}
        onSave={onSave}
        onSync={onSync}
        onPublishToFacebook={onPublishToFacebook}
      />

      <td className="px-2 py-1.5 whitespace-nowrap">
        <div className="font-medium text-white">{row.make ?? "—"}</div>
        <div className="text-xs text-gray-400">{row.model ?? "—"}</div>
      </td>

      <OwnListingTitleCell
        row={row}
        editing={editing}
        editForm={editForm}
        onEditFormChange={onEditFormChange}
        onEditorKeyDown={onEditorKeyDown}
      />

      <td className="px-2 py-1.5 text-gray-400">
        {editing && (
          <div className="text-[10px] text-gray-500">
            {editForm.title.length}
          </div>
        )}
        <div className="whitespace-nowrap">{row.dealer_name}</div>
        {editing && (
          <div className="text-[10px] text-gray-500">
            {editForm.carsbg_title.length}/{CARS_BG_TITLE_MAX_LENGTH}
          </div>
        )}
      </td>

      <td
        className="px-2 py-1.5"
        onClick={
          !editing
            ? (e) => {
                e.stopPropagation();
                onStartEdit(row, true);
              }
            : undefined
        }
        style={!editing ? { cursor: "pointer" } : undefined}
      >
        <OwnListingAdStatusCell
          editing={editing}
          autoOpen={adStatusAutoOpen}
          value={editing ? editForm.ad_status : row.ad_status ?? "none"}
          onSelect={(next) => {
            const nextForm = { ...editForm, ad_status: next };
            onEditFormChange(nextForm);
            onSave({ closeAfterSave: true, formSnapshot: nextForm });
          }}
        />
      </td>

      <OwnListingPriceCell
        editing={editing}
        editForm={editForm}
        row={row}
        onDebouncedPriceSave={onDebouncedPriceSave}
        onEditFormChange={onEditFormChange}
        onEditorKeyDown={onEditorKeyDown}
        onSave={onSave}
        onStartPriceEdit={onStartPriceEdit}
      />

      <td className="px-2 py-1.5 text-center">
        <div className="flex items-center justify-center gap-1.5">
          {row.search_original_position != null ? (
            <span className="font-medium text-sky-200">
              {row.search_original_position}
            </span>
          ) : row.search_checked_at ? (
            <span className="text-xs font-medium text-red-300">{t('not_found')}</span>
          ) : (
            <span className="text-gray-600">—</span>
          )}
          {row.has_saved_search_profile === 1 && (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-500/50 bg-amber-950/40 text-amber-200"
              title={t('uses_saved_search_profile_tooltip')}
            >
              <SearchIcon className="h-3 w-3" />
            </span>
          )}
        </div>
      </td>

      <td className="px-2 py-1.5 text-center">
        {row.search_price_position != null ? (
          <span className="font-medium text-emerald-200">
            {row.search_price_position}
          </span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>

      <td className="px-2 py-1.5">
        {editing ? (
          <select
            value={editForm.vat}
            onChange={(e) => {
              const nextForm = { ...editForm, vat: e.target.value };
              onEditFormChange(nextForm);
              onSave({ closeAfterSave: true, formSnapshot: nextForm });
            }}
            onClick={stopEditorPointerPropagation}
            onMouseDown={stopEditorPointerPropagation}
            onPointerDown={stopEditorPointerPropagation}
            onKeyDown={onEditorKeyDown}
            className="h-8 bg-gray-700 border border-gray-500 rounded px-1 text-white text-sm"
          >
            <option value="">—</option>
            <option value="included">{t('vat_included')}</option>
            <option value="exempt">{t('vat_exempt')}</option>
            <option value="excluded">{t('vat_excluded')}</option>
          </select>
        ) : (
          <VatBadge vat={row.vat} />
        )}
      </td>

      <td className="px-2 py-1.5">
        {editing ? (
          <select
            value={editForm.kaparo}
            onChange={(e) => {
              const nextForm = {
                ...editForm,
                kaparo: parseInt(e.target.value, 10),
              };
              onEditFormChange(nextForm);
              onSave({ closeAfterSave: true, formSnapshot: nextForm });
            }}
            onClick={stopEditorPointerPropagation}
            onMouseDown={stopEditorPointerPropagation}
            onPointerDown={stopEditorPointerPropagation}
            onKeyDown={onEditorKeyDown}
            className="h-8 bg-gray-700 border border-gray-500 rounded px-1 text-white text-sm"
          >
            <option value={0}>—</option>
            <option value={1}>К</option>
          </select>
        ) : (
          <KaparoBadge kaparo={row.kaparo} empty="none" />
        )}
      </td>

      <td className="px-3 py-1.5 text-right text-xs text-gray-300">
        {formatCount(row.watching)}
      </td>

      <td className="px-3 py-1.5 text-right text-xs text-gray-300">
        <div>{formatCount(row.views)}</div>
        {row.cars_total_views != null && (
          <div className="text-[11px] text-orange-200/85">
            {formatCount(row.cars_total_views)}
          </div>
        )}
      </td>

      <td className="w-20 px-2 py-1.5 text-right text-xs text-gray-400">
        <span className="inline-block whitespace-pre-line leading-tight">
          {formatDate(row.last_edit)}
        </span>
      </td>

      <td className="w-20 px-2 py-1.5 text-right text-xs text-gray-400">
        {formatDateOnly(row.carsbg_created_date)}
      </td>

      <td className="px-2 py-1.5">
        {row.is_new === 1 && (
          <span className="rounded-full bg-emerald-900/70 px-2 py-0.5 text-xs text-emerald-200">
            {t('badge_new')}
          </span>
        )}
      </td>

      <td className="px-3 py-1.5 text-right text-gray-400 text-xs">
        <div>{row.reg_month ?? "—"}</div>
        <div>{row.reg_year ?? "—"}</div>
      </td>

      <td className="px-2 py-1.5 text-gray-400 text-xs">
        {row.body_type ?? "—"}
      </td>
      <td className="px-2 py-1.5 text-gray-400 text-xs">{row.fuel ?? "—"}</td>
      <td className="px-2 py-1.5 text-gray-400 text-right text-xs whitespace-nowrap">
        {kmFormatted}
      </td>
    </tr>
  );
}
