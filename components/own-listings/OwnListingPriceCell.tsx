"use client";

import type { KeyboardEvent } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { OwnListingRow } from "@/lib/queries";
import { formatPrice } from "@/lib/utils";
import { getPriceWithVat } from "@/lib/vat";
import { stopEditorPointerPropagation } from "./TableControls";
import type { OwnListingEditForm } from "./editing";

interface OwnListingPriceCellProps {
  editing: boolean;
  editForm: OwnListingEditForm;
  row: OwnListingRow;
  onDebouncedPriceSave: (form: OwnListingEditForm) => void;
  onEditFormChange: (form: OwnListingEditForm) => void;
  onEditorKeyDown: (
    event: KeyboardEvent<
      HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement
    >,
  ) => void;
  onSave: (options?: {
    closeAfterSave?: boolean;
    formSnapshot?: OwnListingEditForm;
  }) => void;
  onStartPriceEdit: (row: OwnListingRow) => void;
}

export function OwnListingPriceCell({
  editing,
  editForm,
  row,
  onDebouncedPriceSave,
  onEditFormChange,
  onEditorKeyDown,
  onSave,
  onStartPriceEdit,
}: OwnListingPriceCellProps) {
  function applyPriceDelta(delta: number) {
    const nextForm = {
      ...editForm,
      current_price: Math.max(0, editForm.current_price + delta),
    };
    onEditFormChange(nextForm);
    onDebouncedPriceSave(nextForm);
  }

  if (editing) {
    return (
      <td className="px-2 py-1.5 text-right whitespace-nowrap">
        <div
          className="inline-flex h-8 overflow-hidden rounded border border-gray-500 bg-gray-700 align-middle"
          onClick={stopEditorPointerPropagation}
          onMouseDown={stopEditorPointerPropagation}
          onPointerDown={stopEditorPointerPropagation}
        >
          <input
            type="text"
            inputMode="numeric"
            value={editForm.current_price}
            onChange={(event) => {
              const digits = event.target.value.replace(/[^0-9]/g, "");
              const value = parseInt(digits, 10);
              const nextForm = {
                ...editForm,
                current_price: isNaN(value) ? 0 : value,
              };
              onEditFormChange(nextForm);
              onDebouncedPriceSave(nextForm);
            }}
            onBlur={() => onSave({ closeAfterSave: true })}
            onKeyDown={onEditorKeyDown}
            className="h-full w-20 border-0 bg-transparent px-1 text-right text-sm text-white outline-none"
          />
          <div className="flex w-7 flex-col border-l border-gray-500">
            <button
              type="button"
              aria-label="Increase price"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                applyPriceDelta(100);
              }}
              className="flex h-4 items-center justify-center text-white hover:bg-gray-600 active:bg-gray-500"
            >
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Decrease price"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                applyPriceDelta(-100);
              }}
              className="flex h-4 items-center justify-center border-t border-gray-500 text-white hover:bg-gray-600 active:bg-gray-500"
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </td>
    );
  }

  const priceWithVat = getPriceWithVat(row.current_price, row.vat);

  return (
    <td
      className="px-2 py-1.5 text-right whitespace-nowrap"
      onClick={(event) => {
        event.stopPropagation();
        onStartPriceEdit(row);
      }}
      style={{ cursor: "pointer" }}
    >
      <div>
        <span className="text-green-400 font-medium">
          {formatPrice(row.current_price)}
        </span>
        {priceWithVat != null && (
          <div className="text-xs text-emerald-200/85">
            {formatPrice(priceWithVat)}
          </div>
        )}
        {row.search_first_result_price != null && (
          <div className="text-[11px] text-gray-400">
            {formatPrice(row.search_first_result_price)}
          </div>
        )}
      </div>
    </td>
  );
}
