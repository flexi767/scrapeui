import type { MobileBgSearchResultRow } from "@/lib/mobile-bg/search-results";

const MONTH_NUMBER_BY_NAME: Record<string, string> = {
  януари: "01",
  февруари: "02",
  март: "03",
  април: "04",
  май: "05",
  юни: "06",
  юли: "07",
  август: "08",
  септември: "09",
  октомври: "10",
  ноември: "11",
  декември: "12",
};

export function truncateDealerLabel(value: string, maxLength = 20) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

export function getDisplayTitle(row: MobileBgSearchResultRow) {
  const title = row.title.trim();
  const make = row.make?.trim();
  const model = row.model?.trim();
  const combined = [make, model].filter(Boolean).join(" ").trim();

  if (combined) {
    const escapedCombined = combined.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const withoutCombined = title.replace(new RegExp(`^${escapedCombined}(?:\\s+|/|$)`, "iu"), "").trim();
    if (withoutCombined) return withoutCombined.replace(/^\/+/, "").trim();
  }

  if (make) {
    const escapedMake = make.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const withoutMake = title.replace(new RegExp(`^${escapedMake}(?:\\s+|/|$)`, "iu"), "").trim();
    if (withoutMake) return withoutMake.replace(/^\/+/, "").trim();
  }

  return title;
}

export function formatRegMonthNumber(value: string | null) {
  if (!value) return "—";
  const normalized = value.trim().toLowerCase();
  return MONTH_NUMBER_BY_NAME[normalized] ?? value;
}

export function formatMileageValue(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US");
}
