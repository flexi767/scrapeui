"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, RefreshCw, X } from "lucide-react";
import { OwnListingRow } from "@/lib/queries";

export function SortHeader({
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

export function stopEditorPointerPropagation(e: { stopPropagation: () => void }) {
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

export function SyncStateButton({
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

export function FbIcon({ className }: { className?: string }) {
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
