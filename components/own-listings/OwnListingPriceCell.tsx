"use client";

import type { KeyboardEvent } from "react";
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
}

export function OwnListingPriceCell({
  editing,
  editForm,
  row,
  onDebouncedPriceSave,
  onEditFormChange,
  onEditorKeyDown,
  onSave,
}: OwnListingPriceCellProps) {
  if (editing) {
    return (
      <td className="px-2 py-1.5 text-right whitespace-nowrap">
        <input
          type="number"
          min="0"
          step="100"
          value={editForm.current_price}
          onChange={(event) => {
            const value = parseInt(event.target.value, 10);
            const nextForm = {
              ...editForm,
              current_price: isNaN(value) ? 0 : value,
            };
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
      </td>
    );
  }

  const priceWithVat = getPriceWithVat(row.current_price, row.vat);

  return (
    <td className="px-2 py-1.5 text-right whitespace-nowrap">
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
