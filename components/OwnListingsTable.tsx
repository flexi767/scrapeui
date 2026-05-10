"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  launchFacebookMarketplaceDraft,
  saveOwnListingEdit,
  syncOwnListingToMobileBg,
} from "@/components/own-listings/api";
import { OwnListingsTableHeader } from "@/components/own-listings/TableHeader";
import { OwnListingTableRow } from "@/components/own-listings/OwnListingTableRow";
import {
  EMPTY_OWN_LISTING_EDIT_FORM,
  getEditFormFromOwnListing,
  getOwnListingRowKey,
  type OwnListingEditForm,
} from "@/components/own-listings/editing";
import { OwnListingRow } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";

interface Props {
  initialRows: OwnListingRow[];
}

export default function OwnListingsTable({ initialRows }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<OwnListingRow[]>(initialRows);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [syncingIds, setSyncingIds] = useState<Record<number, boolean>>({});
  const [publishingToFbIds, setPublishingToFbIds] = useState<Record<number, boolean>>({});
  const [editForm, setEditForm] = useState<OwnListingEditForm>(EMPTY_OWN_LISTING_EDIT_FORM);
  const [saving, setSaving] = useState(false);
  const tableKey = searchParams.toString();
  const priceSaveTimeoutRef = useRef<number | null>(null);

  function clearPriceSaveTimeout() {
    if (priceSaveTimeoutRef.current != null) {
      window.clearTimeout(priceSaveTimeoutRef.current);
      priceSaveTimeoutRef.current = null;
    }
  }

  function startEdit(row: OwnListingRow) {
    if (saving) return;
    clearPriceSaveTimeout();
    setEditForm(getEditFormFromOwnListing(row));
    setEditingKey(getOwnListingRowKey(row));
  }

  async function handleSave(options?: {
    closeAfterSave?: boolean;
    formSnapshot?: typeof editForm;
  }) {
    clearPriceSaveTimeout();
    const formToSave = options?.formSnapshot ?? editForm;

    if (formToSave.current_price < 0) {
      toast.error("Price must be non-negative");
      return;
    }

    setSaving(true);
    try {
      const editingRow = rows.find((row) => getOwnListingRowKey(row) === editingKey);
      if (!editingRow) {
        toast.error("No listing is currently being edited.");
        return;
      }

      const data = await saveOwnListingEdit(editingRow, formToSave);
      if (editingRow.mobile_id) {
        const updated = data as OwnListingRow;
        setRows((prev) =>
          prev.map((r) => (r.mobile_id === updated.mobile_id ? updated : r)),
        );
      } else {
        const updated = data as Partial<OwnListingRow>;
        setRows((prev) =>
          prev.map((row) =>
            row.backup_id === editingRow.backup_id
              ? {
                  ...row,
                  ...updated,
                  carsbg_title: formToSave.carsbg_title,
                }
              : row,
          ),
        );
      }
      if (options?.closeAfterSave) {
        setEditingKey(null);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function handleEditorKeyDown(
    e: KeyboardEvent<
      HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement
    >,
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    if (!saving) {
      void handleSave({ closeAfterSave: true });
    }
  }

  function debouncedPriceSave(nextForm: OwnListingEditForm) {
    clearPriceSaveTimeout();
    priceSaveTimeoutRef.current = window.setTimeout(() => {
      void handleSave({
        closeAfterSave: true,
        formSnapshot: nextForm,
      });
    }, 1000);
  }

  async function handleSync(row: OwnListingRow) {
    setRows((prev) =>
      prev.map((item) =>
        item.backup_id === row.backup_id
          ? {
              ...item,
              last_mobile_sync_status: "running",
              last_mobile_sync_error: null,
            }
          : item,
      ),
    );
    setSyncingIds((prev) => ({ ...prev, [row.backup_id]: true }));
    try {
      await syncOwnListingToMobileBg(row);
      setRows((prev) =>
        prev.map((item) =>
          item.backup_id === row.backup_id
            ? {
                ...item,
                needs_sync: 0,
                last_mobile_sync_status: "success",
                last_mobile_sync_error: null,
                last_mobile_sync_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      toast.success("Listing synced to mobile.bg");
      router.refresh();
    } catch (error) {
      const message = errorMessage(error);
      setRows((prev) =>
        prev.map((item) =>
          item.backup_id === row.backup_id
            ? {
                ...item,
                last_mobile_sync_status: "failed",
                last_mobile_sync_error: message,
              }
            : item,
        ),
      );
      toast.error(message);
    } finally {
      setSyncingIds((prev) => ({ ...prev, [row.backup_id]: false }));
    }
  }

  async function handlePublishToFB(row: OwnListingRow) {
    setPublishingToFbIds((prev) => ({ ...prev, [row.backup_id]: true }));
    try {
      const message = await launchFacebookMarketplaceDraft(row);
      toast.success(message);
    } catch (error) {
      toast.error(
        errorMessage(error),
      );
    } finally {
      setPublishingToFbIds((prev) => ({ ...prev, [row.backup_id]: false }));
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700/60">
      <table
        key={tableKey}
        className="w-full text-sm"
        style={{ borderCollapse: "collapse" }}
      >
        <OwnListingsTableHeader />
        <tbody className="divide-y divide-gray-700/50">
          {rows.length === 0 && (
            <tr>
              <td colSpan={19} className="px-4 py-6 text-center text-gray-500">
                No listings
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const rowKey = getOwnListingRowKey(row);
            const editing = editingKey === rowKey;
            return <OwnListingTableRow
                key={rowKey}
                row={row}
                editing={editing}
                editForm={editForm}
                saving={saving}
                syncing={Boolean(syncingIds[row.backup_id])}
                publishingToFb={Boolean(publishingToFbIds[row.backup_id])}
                onStartEdit={startEdit}
                onEditFormChange={setEditForm}
                onSave={(options) => void handleSave(options)}
                onDebouncedPriceSave={debouncedPriceSave}
                onSync={(targetRow) => void handleSync(targetRow)}
                onPublishToFacebook={(targetRow) => void handlePublishToFB(targetRow)}
                onEditorKeyDown={handleEditorKeyDown}
              />;
          })}
        </tbody>
      </table>
    </div>
  );
}
