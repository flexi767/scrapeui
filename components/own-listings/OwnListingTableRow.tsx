"use client";

import { type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { InstagramIcon, SearchIcon } from "lucide-react";
import { ListingThumbPreview } from "@/components/ListingThumbPreview";
import { TikTokIcon } from "@/components/tiktok/TikTokIcon";
import { AdStatusBadge } from "@/components/listings/AdStatusBadge";
import { KaparoBadge, VatBadge } from "@/components/listings/VatBadge";
import ListingSearchPrefillButton from "@/components/ListingSearchPrefillButton";
import { formatDateOnly } from "@/lib/date-format";
import { getListingThumbAlt, getListingThumbSrc } from "@/lib/listing-thumb";
import { OwnListingRow } from "@/lib/queries";
import { formatCount, formatDate, formatPrice } from "@/lib/utils";
import { getPriceWithVat } from "@/lib/vat";
import {
  FbIcon,
  SyncStateButton,
  stopEditorPointerPropagation,
} from "./TableControls";
import { getOwnListingRowKey, type OwnListingEditForm } from "./editing";

interface OwnListingTableRowProps {
  row: OwnListingRow;
  editing: boolean;
  editForm: OwnListingEditForm;
  saving: boolean;
  syncing: boolean;
  publishingToFb: boolean;
  onStartEdit: (row: OwnListingRow) => void;
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
  onStartEdit,
  onEditFormChange,
  onSave,
  onDebouncedPriceSave,
  onSync,
  onPublishToFacebook,
  onEditorKeyDown,
}: OwnListingTableRowProps) {  const router = useRouter();  const thumbSrc = getListingThumbSrc(row);
  const thumbAlt = getListingThumbAlt(row);
  const kmFormatted =
    formatCount(row.mileage);

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
      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <div className="flex flex-row items-start gap-1">
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPublishToFacebook(row);
                }}
                disabled={publishingToFb}
                title="Publish to Facebook Marketplace"
                aria-label="Publish to Facebook Marketplace"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-600/50 text-[#1877F2] hover:bg-blue-900/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FbIcon className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/instagram/publish/${row.backup_id}`);
                }}
                title="Publish to Instagram"
                aria-label="Publish to Instagram"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-pink-500/50 text-pink-300 hover:bg-pink-950/40"
              >
                <InstagramIcon className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/tiktok/publish/${row.backup_id}`);
                }}
                title="Create TikTok video"
                aria-label="Create TikTok video"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-400/50 text-cyan-200 hover:bg-cyan-950/40"
              >
                <TikTokIcon className="h-3 w-3" />
              </button>
            </div>
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
                  title="Save"
                  className="text-green-400 hover:text-green-300 disabled:opacity-50 text-base leading-none"
                >
                  ✓
                </button>
              ) : (
                <button
                  onClick={() => onStartEdit(row)}
                  disabled={saving}
                  title="Edit"
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

      <td className="px-2 py-1.5 whitespace-nowrap">
        <div className="font-medium text-white">{row.make ?? "—"}</div>
        <div className="text-xs text-gray-400">{row.model ?? "—"}</div>
      </td>

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
            <div>
              <input
                type="text"
                maxLength={15}
                value={editForm.carsbg_title}
                onChange={(e) =>
                  onEditFormChange({
                    ...editForm,
                    carsbg_title: e.target.value.slice(0, 15),
                  })
                }
                onClick={stopEditorPointerPropagation}
                onMouseDown={stopEditorPointerPropagation}
                onPointerDown={stopEditorPointerPropagation}
                onKeyDown={onEditorKeyDown}
                placeholder="cars.bg title"
                className="w-full rounded border border-gray-500 bg-gray-700 px-2 py-1 text-xs leading-5 text-white"
              />
            </div>
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

      <td className="px-2 py-1.5 text-gray-400">
        {editing && (
          <div className="text-[10px] text-gray-500">
            {editForm.title.length}
          </div>
        )}
        <div className="whitespace-nowrap">{row.dealer_name}</div>
        {editing && (
          <div className="text-[10px] text-gray-500">
            {editForm.carsbg_title.length}/15
          </div>
        )}
      </td>

      <td className="px-2 py-1.5">
        {editing ? (
          <select
            value={editForm.ad_status}
            onChange={(e) => {
              const nextForm = { ...editForm, ad_status: e.target.value };
              onEditFormChange(nextForm);
              onSave({ closeAfterSave: true, formSnapshot: nextForm });
            }}
            onClick={stopEditorPointerPropagation}
            onMouseDown={stopEditorPointerPropagation}
            onPointerDown={stopEditorPointerPropagation}
            onKeyDown={onEditorKeyDown}
            className="h-8 bg-gray-700 border border-gray-500 rounded px-1 text-white text-sm"
          >
            <option value="none">—</option>
            <option value="TOP">TOP</option>
            <option value="VIP">VIP</option>
          </select>
        ) : (
          <AdStatusBadge
            status={row.ad_status ?? "none"}
            empty="none"
            className="text-xs"
          />
        )}
      </td>

      <td className="px-2 py-1.5 text-right whitespace-nowrap">
        {editing ? (
          <input
            type="number"
            min="0"
            step="100"
            value={editForm.current_price}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              const nextForm = { ...editForm, current_price: isNaN(v) ? 0 : v };
              onEditFormChange(nextForm);
              onDebouncedPriceSave(nextForm);
            }}
            onBlur={() => onSave({ closeAfterSave: true })}
            onClick={stopEditorPointerPropagation}
            onMouseDown={stopEditorPointerPropagation}
            onPointerDown={stopEditorPointerPropagation}
            onKeyDown={onEditorKeyDown}
            className="h-8 w-24 bg-gray-700 border border-gray-500 rounded px-1 text-white text-sm text-right"
          />
        ) : (
          <div>
            <span className="text-green-400 font-medium">
              {formatPrice(row.current_price)}
            </span>
            {getPriceWithVat(row.current_price, row.vat) != null && (
              <div className="text-xs text-emerald-200/85">
                {formatPrice(getPriceWithVat(row.current_price, row.vat))}
              </div>
            )}
            {row.search_first_result_price != null && (
              <div className="text-[11px] text-gray-400">
                {formatPrice(row.search_first_result_price)}
              </div>
            )}
          </div>
        )}
      </td>

      <td className="px-2 py-1.5 text-center">
        <div className="flex items-center justify-center gap-1.5">
          {row.search_original_position != null ? (
            <span className="font-medium text-sky-200">
              {row.search_original_position}
            </span>
          ) : row.search_checked_at ? (
            <span className="text-xs font-medium text-red-300">not found</span>
          ) : (
            <span className="text-gray-600">—</span>
          )}
          {row.has_saved_search_profile === 1 && (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-500/50 bg-amber-950/40 text-amber-200"
              title="Uses saved custom search values for search-position checks"
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
            <option value="included">има</option>
            <option value="exempt">няма</option>
            <option value="excluded">+ДДС</option>
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
          {formatDate(row.last_edit).replace(/,\s+/, "\n")}
        </span>
      </td>

      <td className="w-20 px-2 py-1.5 text-right text-xs text-gray-400">
        {formatDateOnly(row.carsbg_created_date)}
      </td>

      <td className="px-2 py-1.5">
        {row.is_new === 1 && (
          <span className="rounded-full bg-emerald-900/70 px-2 py-0.5 text-xs text-emerald-200">
            new
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
