import Link from 'next/link';
import { listingCursorHref, listingPageHref } from '@/lib/listing-url';

interface Props {
  page: number;
  totalPages: number;
  nextCursor?: string | null;
  cursorActive?: boolean;
  currentParams: URLSearchParams;
  basePath: string;
}

function getPageWindow(page: number, totalPages: number): number[] {
  const maxVisible = 9;
  if (totalPages <= maxVisible) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const half = Math.floor(maxVisible / 2);
  const start = Math.max(1, Math.min(page - half, totalPages - maxVisible + 1));
  return Array.from({ length: maxVisible }, (_, i) => start + i);
}

export function ListingsPagination({ page, totalPages, nextCursor, cursorActive = false, currentParams, basePath }: Props) {
  if (totalPages <= 1 && !nextCursor) return null;
  if (cursorActive) {
    return (
      <div className="mt-4 flex items-center justify-center gap-2 text-sm">
        <Link
          href={listingPageHref(basePath, currentParams, 1)}
          className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
        >
          First
        </Link>
        {nextCursor && (
          <Link
            href={listingCursorHref(basePath, currentParams, nextCursor)}
            className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
          >
            Next
          </Link>
        )}
      </div>
    );
  }

  const pageNumbers = getPageWindow(page, totalPages);
  const nextHref = nextCursor
    ? listingCursorHref(basePath, currentParams, nextCursor)
    : listingPageHref(basePath, currentParams, page + 1);

  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-sm">
      {page > 1 && (
        <Link
          href={listingPageHref(basePath, currentParams, page - 1)}
          className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
        >
          Prev
        </Link>
      )}
      {pageNumbers[0] > 1 && (
        <>
          <Link
            href={listingPageHref(basePath, currentParams, 1)}
            className="min-w-9 rounded border border-gray-600 px-3 py-1.5 text-center text-gray-300 hover:border-gray-400 hover:text-white"
          >
            1
          </Link>
          <span className="px-1 text-gray-500">...</span>
        </>
      )}
      {pageNumbers.map((n) =>
        n === page ? (
          <span
            key={n}
            className="min-w-9 cursor-default rounded border border-blue-500 bg-blue-500/15 px-3 py-1.5 text-center text-white"
          >
            {n}
          </span>
        ) : (
          <Link
            key={n}
            href={listingPageHref(basePath, currentParams, n)}
            className="min-w-9 rounded border border-gray-600 px-3 py-1.5 text-center text-gray-300 hover:border-gray-400 hover:text-white"
          >
            {n}
          </Link>
        )
      )}
      {pageNumbers[pageNumbers.length - 1] < totalPages && (
        <>
          <span className="px-1 text-gray-500">...</span>
          <Link
            href={listingPageHref(basePath, currentParams, totalPages)}
            className="min-w-9 rounded border border-gray-600 px-3 py-1.5 text-center text-gray-300 hover:border-gray-400 hover:text-white"
          >
            {totalPages}
          </Link>
        </>
      )}
      {(nextCursor || page < totalPages) && (
        <Link
          href={nextHref}
          className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
        >
          Next
        </Link>
      )}
    </div>
  );
}
