"use client";

import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, RefreshCw, SearchIcon, X } from "lucide-react";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import ListingSearchPrefillButton from "@/components/ListingSearchPrefillButton";
import { OwnListingRow } from "@/lib/queries";
import {
  formatPrice,
  formatDate,
  buildImageList,
  getPreferredListingThumbUrl,
  parseJson,
} from "@/lib/utils";
import { getPriceWithVat } from "@/lib/vat";

interface Props {
  initialRows: OwnListingRow[];
}

function SortHeader({
  label,
  sortKey,
  align = "left",
}: {
  label: string;
  sortKey: string;
  align?: "left" | "center" | "right";
}) {
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") ?? "last_edit";
  const currentOrder = searchParams.get("order") ?? "desc";
  const params = new URLSearchParams(searchParams.toString());
  params.delete("page");

  if (currentSort === sortKey) {
    params.set("order", currentOrder === "asc" ? "desc" : "asc");
  } else {
    params.set("sort", sortKey);
    params.set("order", "desc");
  }

  const arrow =
    currentSort === sortKey ? (currentOrder === "asc" ? " ↑" : " ↓") : "";
  const alignClass =
    align === "center"
      ? "justify-center"
      : align === "right"
        ? "justify-end"
        : "justify-start";

  return (
    <Link
      href={`/editown?${params.toString()}`}
      className={`flex w-full items-center ${alignClass} hover:text-white`}
    >
      {label}
      {arrow}
    </Link>
  );
}

function AdStatusBadge({ status }: { status: string }) {
  if (!status || status === "none") return null;
  if (status.toUpperCase() === "TOP")
    return (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
        style={{ backgroundColor: "#1a6496" }}
      >
        TOP
      </span>
    );
  if (status.toUpperCase() === "VIP")
    return (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
        style={{ backgroundColor: "#c0392b" }}
      >
        VIP
      </span>
    );
  return null;
}

function VatBadge({ vat }: { vat: string | null }) {
  if (vat === "included")
    return (
      <span className="rounded-full bg-blue-900/70 px-2 py-0.5 text-[11px] text-blue-200">
        има
      </span>
    );
  if (vat === "exempt")
    return (
      <span className="rounded-full bg-green-900/70 px-2 py-0.5 text-[11px] text-green-200">
        няма
      </span>
    );
  if (vat === "excluded")
    return (
      <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-[11px] text-red-200">
        +ДДС
      </span>
    );
  return <span className="text-gray-600">—</span>;
}

function KaparoBadge({ kaparo }: { kaparo: number }) {
  if (!kaparo) return null;
  return (
    <span className="rounded-full bg-orange-900/70 px-2 py-0.5 text-xs text-orange-200">
      К
    </span>
  );
}

function stopEditorPointerPropagation(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

function StatusSymbol({
  title,
  className,
  children,
}: {
  title: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${className}`}
    >
      {children}
    </span>
  );
}

function SyncStateButton({
  row,
  syncing,
  onSync,
}: {
  row: OwnListingRow;
  syncing: boolean;
  onSync: () => void;
}) {
  if (syncing) {
    return (
      <button
        disabled
        title="Syncing…"
        aria-label="Syncing"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-500/50 text-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <RefreshCw className="h-3 w-3 animate-spin" />
      </button>
    );
  }

  if (row.last_mobile_sync_status === "failed") {
    return (
      <button
        onClick={onSync}
        title={row.last_mobile_sync_error || "Sync failed. Retry"}
        aria-label="Retry sync"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 text-red-300 hover:bg-red-500/10"
      >
        <X className="h-3 w-3" />
      </button>
    );
  }

  if (row.needs_sync === 1 || row.last_mobile_sync_status === "pending") {
    return (
      <button
        onClick={onSync}
        title="Sync pending"
        aria-label="Start sync"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-500/60 text-blue-200 hover:bg-blue-500/10"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    );
  }

  if (row.last_mobile_sync_status === "success") {
    return (
      <StatusSymbol
        title="Sync succeeded"
        className="border-emerald-500/50 text-emerald-300"
      >
        <Check className="h-3 w-3" />
      </StatusSymbol>
    );
  }

  return (
    <StatusSymbol title="Up to date" className="border-gray-700 text-gray-400">
      <Check className="h-3 w-3" />
    </StatusSymbol>
  );
}

function FbIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

export default function OwnListingsTable({ initialRows }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<OwnListingRow[]>(initialRows);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [syncingIds, setSyncingIds] = useState<Record<number, boolean>>({});
  const [publishingToFbIds, setPublishingToFbIds] = useState<Record<number, boolean>>({});
  const [editForm, setEditForm] = useState<{
    title: string;
    carsbg_title: string;
    current_price: number;
    vat: string;
    kaparo: number;
    ad_status: string;
  }>({
    title: "",
    carsbg_title: "",
    current_price: 0,
    vat: "",
    kaparo: 0,
    ad_status: "none",
  });
  const [saving, setSaving] = useState(false);
  const tableKey = searchParams.toString();
  const priceSaveTimeoutRef = useRef<number | null>(null);

  function clearPriceSaveTimeout() {
    if (priceSaveTimeoutRef.current != null) {
      window.clearTimeout(priceSaveTimeoutRef.current);
      priceSaveTimeoutRef.current = null;
    }
  }

  function formatDateOnly(value: string | null | undefined): string {
    if (!value) return "—";
    const plain = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (plain) return `${plain[3]}.${plain[2]}.${plain[1].slice(2)}`;
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = String(d.getFullYear()).slice(2);
      return `${dd}.${mm}.${yy}`;
    }
    return value;
  }

  function getRowKey(row: OwnListingRow): string {
    return row.mobile_id ? `mobile-${row.mobile_id}` : `backup-${row.backup_id}`;
  }

  function startEdit(row: OwnListingRow) {
    if (saving) return;
    clearPriceSaveTimeout();
    setEditForm({
      title: row.title ?? "",
      carsbg_title: row.carsbg_title ?? "",
      current_price: row.current_price ?? 0,
      vat: row.vat ?? "",
      kaparo: row.kaparo ?? 0,
      ad_status: row.ad_status ?? "none",
    });
    setEditingKey(getRowKey(row));
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
      const editingRow = rows.find((row) => getRowKey(row) === editingKey);
      if (!editingRow) {
        toast.error("No listing is currently being edited.");
        return;
      }

      const res = await fetch(
        editingRow.mobile_id
          ? `/api/listings/${editingRow.mobile_id}`
          : `/api/editown/backups/${editingRow.backup_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formToSave.title,
            carsbg_title: formToSave.carsbg_title,
            current_price: formToSave.current_price,
            vat: formToSave.vat,
            kaparo: formToSave.kaparo,
            ad_status: formToSave.ad_status,
          }),
        },
      );
      if (res.ok) {
        if (editingRow.mobile_id) {
          const updated: OwnListingRow = await res.json();
          setRows((prev) =>
            prev.map((r) => (r.mobile_id === updated.mobile_id ? updated : r)),
          );
        } else {
          const updated = await res.json() as Partial<OwnListingRow>;
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
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Save failed");
      }
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
      const res = await fetch("/api/mobilebg/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealerSlug: row.dealer_slug,
          backupId: row.backup_id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || "Sync failed";
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
        return;
      }

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
      const message = error instanceof Error ? error.message : "Sync failed";
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
      const res = await fetch("/api/facebook-marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId: row.backup_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to launch Facebook Marketplace");
      } else {
        toast.success(
          data.message ?? "Facebook Marketplace browser launched",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to launch",
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
        <thead>
          <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
            <th className="w-16 px-3 py-1.5 text-left">Img</th>
            <th className="px-3 py-1.5 text-left">Make / Model</th>
            <th className="px-3 py-1.5 text-left">Title</th>
            <th className="px-3 py-1.5 text-left">
              <SortHeader label="Dealer" sortKey="dealer" />
            </th>
            <th className="px-2 py-1.5 text-center w-14">
              <SortHeader label="Paid" sortKey="ad_status" align="center" />
            </th>
            <th className="pl-1 pr-3 py-1.5 text-right">
              <SortHeader label="Price" sortKey="price" align="right" />
            </th>
            <th className="px-3 py-1.5 text-center">Orig #</th>
            <th className="px-3 py-1.5 text-center">Price #</th>
            <th className="px-3 py-1.5 text-center">VAT</th>
            <th className="px-2 py-1.5 text-center w-14">К</th>
            <th className="px-3 py-1.5 text-right">W</th>
            <th className="px-3 py-1.5 text-right">
              <SortHeader label="Views" sortKey="views" align="right" />
            </th>
            <th className="px-3 py-1.5 text-right">
              <SortHeader label="Last Edit" sortKey="last_edit" align="right" />
            </th>
            <th className="px-3 py-1.5 text-right">
              <SortHeader
                label="cars.bg created"
                sortKey="carsbg_created_date"
                align="right"
              />
            </th>
            <th className="px-2 py-1.5 text-center w-12">New</th>
            <th className="px-3 py-1.5 text-right">
              <SortHeader label="Year" sortKey="reg_year" align="right" />
            </th>
            <th className="px-3 py-1.5 text-center">Body Type</th>
            <th className="px-3 py-1.5 text-center">
              <SortHeader label="Fuel" sortKey="fuel" align="center" />
            </th>
            <th className="px-3 py-1.5 text-right">
              <SortHeader label="KM" sortKey="mileage" align="right" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {rows.length === 0 && (
            <tr>
              <td colSpan={19} className="px-4 py-6 text-center text-gray-500">
                No listings
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const rowKey = getRowKey(row);
            const editing = editingKey === rowKey;

            const imageMeta = parseJson<{ cdn: string; shard: string } | null>(
              row.image_meta,
              null,
            );
            const thumbKeys = parseJson<string[]>(row.thumb_keys, []);
            const fullKeys = parseJson<string[]>(row.full_keys, []);
            const images = buildImageList(
              row.mobile_id,
              fullKeys.length ? fullKeys : thumbKeys,
              thumbKeys,
              imageMeta,
              row.images_downloaded === 1,
            );
            const thumbSrc = row.first_backup_image_id
              ? `/api/mobilebg-backup-images/${row.first_backup_image_id}`
              : getPreferredListingThumbUrl(
                  row.mobile_id,
                  images[0]?.thumb,
                  row.thumb_saved,
                );

            const kmFormatted =
              row.mileage != null ? row.mileage.toLocaleString("en-US") : "—";
            return (
              <tr
                key={rowKey}
                className={`align-middle transition-colors ${
                  editing
                    ? "bg-gray-800"
                    : row.search_checked_at &&
                        row.search_original_position == null
                      ? "bg-red-950/20 hover:bg-red-950/30"
                      : "hover:bg-gray-800/50"
                }`}
                onClick={!editing ? () => startEdit(row) : undefined}
                style={{ cursor: editing ? "default" : "pointer" }}
              >
                {/* Img */}
                <td
                  className="px-2 py-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <SyncStateButton
                        row={row}
                        syncing={Boolean(syncingIds[row.backup_id])}
                        onSync={() => handleSync(row)}
                      />
                      {editing ? (
                        <button
                          onClick={() =>
                            void handleSave({ closeAfterSave: true })
                          }
                          disabled={saving}
                          title="Save"
                          className="text-green-400 hover:text-green-300 disabled:opacity-50 text-base leading-none"
                        >
                          ✓
                        </button>
                      ) : (
                        <button
                          onClick={() => startEdit(row)}
                          disabled={saving}
                          title="Edit"
                          className={`text-gray-400 hover:text-white text-base leading-none ${saving ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                        >
                          ✎
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handlePublishToFB(row);
                        }}
                        disabled={Boolean(publishingToFbIds[row.backup_id])}
                        title="Publish to Facebook Marketplace"
                        aria-label="Publish to Facebook Marketplace"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-600/50 text-[#1877F2] hover:bg-blue-900/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FbIcon className="h-3 w-3" />
                      </button>
                    </div>
                    <ListingSearchPrefillButton listingId={row.id} />
                    {thumbSrc ? (
                      <div className="relative inline-block w-16">
                        <ImageWithFallback
                          src={thumbSrc}
                          alt={
                            `${row.make ?? "Listing"} ${row.model ?? ""}`.trim() ||
                            "Listing image"
                          }
                          className="peer w-16 rounded object-contain"
                          style={{ aspectRatio: "4/3" }}
                          fallbackClassName="peer w-16 rounded bg-gray-800 text-gray-400"
                          fallbackLabel="Missing"
                        />
                        <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-64 peer-hover:block">
                          <ImageWithFallback
                            src={thumbSrc}
                            alt={
                              `${row.make ?? "Listing"} ${row.model ?? ""}`.trim() ||
                              "Listing image preview"
                            }
                            className="w-full rounded shadow-xl"
                            fallbackClassName="w-full rounded bg-gray-800 text-gray-400 shadow-xl"
                            fallbackLabel="Missing"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="h-12 w-16 rounded bg-gray-700" />
                    )}
                  </div>
                </td>

                {/* Make / Model */}
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <div className="font-medium text-white">
                    {row.make ?? "—"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {row.model ?? "—"}
                  </div>
                </td>

                {/* Title */}
                <td className="px-2 py-1.5 max-w-[200px]">
                  {editing ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={editForm.title}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, title: e.target.value }))
                        }
                        onClick={stopEditorPointerPropagation}
                        onMouseDown={stopEditorPointerPropagation}
                        onPointerDown={stopEditorPointerPropagation}
                        onKeyDown={handleEditorKeyDown}
                        className="min-h-12 w-full rounded border border-gray-500 bg-gray-700 px-2 py-1 text-xs leading-5 text-white resize-y"
                      />
                      <div>
                        <input
                          type="text"
                          maxLength={15}
                          value={editForm.carsbg_title}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              carsbg_title: e.target.value.slice(0, 15),
                            }))
                          }
                          onClick={stopEditorPointerPropagation}
                          onMouseDown={stopEditorPointerPropagation}
                          onPointerDown={stopEditorPointerPropagation}
                          onKeyDown={handleEditorKeyDown}
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

                {/* Dealer */}
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

                {/* Ad Status */}
                <td className="px-2 py-1.5">
                  {editing ? (
                    <select
                      value={editForm.ad_status}
                      onChange={(e) => {
                        const nextForm = {
                          ...editForm,
                          ad_status: e.target.value,
                        };
                        setEditForm(nextForm);
                        void handleSave({
                          closeAfterSave: true,
                          formSnapshot: nextForm,
                        });
                      }}
                      onClick={stopEditorPointerPropagation}
                      onMouseDown={stopEditorPointerPropagation}
                      onPointerDown={stopEditorPointerPropagation}
                      onKeyDown={handleEditorKeyDown}
                      className="h-8 bg-gray-700 border border-gray-500 rounded px-1 text-white text-sm"
                    >
                      <option value="none">—</option>
                      <option value="TOP">TOP</option>
                      <option value="VIP">VIP</option>
                    </select>
                  ) : (
                    <AdStatusBadge status={row.ad_status ?? "none"} />
                  )}
                </td>

                {/* Price */}
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {editing ? (
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={editForm.current_price}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        const nextForm = {
                          ...editForm,
                          current_price: isNaN(v) ? 0 : v,
                        };
                        setEditForm(nextForm);
                        clearPriceSaveTimeout();
                        priceSaveTimeoutRef.current = window.setTimeout(() => {
                          void handleSave({
                            closeAfterSave: true,
                            formSnapshot: nextForm,
                          });
                        }, 1000);
                      }}
                      onBlur={() => {
                        clearPriceSaveTimeout();
                        void handleSave({ closeAfterSave: true });
                      }}
                      onClick={stopEditorPointerPropagation}
                      onMouseDown={stopEditorPointerPropagation}
                      onPointerDown={stopEditorPointerPropagation}
                      onKeyDown={handleEditorKeyDown}
                      className="h-8 w-24 bg-gray-700 border border-gray-500 rounded px-1 text-white text-sm text-right"
                    />
                  ) : (
                    <div>
                      <span className="text-green-400 font-medium">
                        {formatPrice(row.current_price)}
                      </span>
                      {getPriceWithVat(row.current_price, row.vat) != null && (
                        <div className="text-xs text-emerald-200/85">
                          {formatPrice(
                            getPriceWithVat(row.current_price, row.vat),
                          )}
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
                      <span className="text-xs font-medium text-red-300">
                        not found
                      </span>
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

                {/* VAT */}
                <td className="px-2 py-1.5">
                  {editing ? (
                    <select
                      value={editForm.vat}
                      onChange={(e) => {
                        const nextForm = { ...editForm, vat: e.target.value };
                        setEditForm(nextForm);
                        void handleSave({
                          closeAfterSave: true,
                          formSnapshot: nextForm,
                        });
                      }}
                      onClick={stopEditorPointerPropagation}
                      onMouseDown={stopEditorPointerPropagation}
                      onPointerDown={stopEditorPointerPropagation}
                      onKeyDown={handleEditorKeyDown}
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

                {/* Kaparo */}
                <td className="px-2 py-1.5">
                  {editing ? (
                    <select
                      value={editForm.kaparo}
                      onChange={(e) => {
                        const nextForm = {
                          ...editForm,
                          kaparo: parseInt(e.target.value, 10),
                        };
                        setEditForm(nextForm);
                        void handleSave({
                          closeAfterSave: true,
                          formSnapshot: nextForm,
                        });
                      }}
                      onClick={stopEditorPointerPropagation}
                      onMouseDown={stopEditorPointerPropagation}
                      onPointerDown={stopEditorPointerPropagation}
                      onKeyDown={handleEditorKeyDown}
                      className="h-8 bg-gray-700 border border-gray-500 rounded px-1 text-white text-sm"
                    >
                      <option value={0}>—</option>
                      <option value={1}>К</option>
                    </select>
                  ) : (
                    <KaparoBadge kaparo={row.kaparo} />
                  )}
                </td>

                {/* Watching */}
                <td className="px-3 py-1.5 text-right text-xs text-gray-300">
                  {row.watching != null
                    ? row.watching.toLocaleString("en-US")
                    : "—"}
                </td>

                {/* Views */}
                <td className="px-3 py-1.5 text-right text-xs text-gray-300">
                  <div>
                    {row.views != null
                      ? row.views.toLocaleString("en-US")
                      : "—"}
                  </div>
                  {row.cars_total_views != null && (
                    <div className="text-[11px] text-orange-200/85">
                      {row.cars_total_views.toLocaleString("en-US")}
                    </div>
                  )}
                </td>

                {/* Last Edit */}
                <td className="w-20 px-2 py-1.5 text-right text-xs text-gray-400">
                  <span className="inline-block whitespace-pre-line leading-tight">
                    {formatDate(row.last_edit).replace(/,\s+/, "\n")}
                  </span>
                </td>

                {/* cars.bg created */}
                <td className="w-20 px-2 py-1.5 text-right text-xs text-gray-400">
                  {formatDateOnly(row.carsbg_created_date)}
                </td>

                {/* New */}
                <td className="px-2 py-1.5">
                  {row.is_new === 1 && (
                    <span className="rounded-full bg-emerald-900/70 px-2 py-0.5 text-xs text-emerald-200">
                      new
                    </span>
                  )}
                </td>

                {/* Year */}
                <td className="px-3 py-1.5 text-right text-gray-400 text-xs">
                  <div>{row.reg_month ?? "—"}</div>
                  <div>{row.reg_year ?? "—"}</div>
                </td>

                {/* Category */}
                <td className="px-2 py-1.5 text-gray-400 text-xs">
                  {row.body_type ?? "—"}
                </td>

                {/* Fuel */}
                <td className="px-2 py-1.5 text-gray-400 text-xs">
                  {row.fuel ?? "—"}
                </td>

                {/* KM */}
                <td className="px-2 py-1.5 text-gray-400 text-right text-xs whitespace-nowrap">
                  {kmFormatted}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
