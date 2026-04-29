import Link from "next/link";
import { listingSortHref, sortArrow } from "@/lib/listing-url";

export function SortLink({
  label,
  sortKey,
  currentSort,
  currentOrder,
  params,
  basePath,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentOrder: string;
  params: URLSearchParams;
  basePath: string;
}) {
  return (
    <Link
      href={listingSortHref({
        basePath,
        currentParams: params,
        sortKey,
        currentSort,
        currentOrder,
      })}
      className="hover:text-white"
    >
      {label}
      {sortArrow(sortKey, currentSort, currentOrder)}
    </Link>
  );
}
