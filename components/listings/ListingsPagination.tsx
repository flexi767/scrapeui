import Link from 'next/link';
import { listingPageHref } from '@/lib/listing-url';

interface Props {
  page: number;
  totalPages: number;
  currentParams: URLSearchParams;
  basePath: string;
}

export function ListingsPagination({ page, totalPages, currentParams, basePath }: Props) {
  if (totalPages <= 1) return null;
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
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
      {page < totalPages && (
        <Link
          href={listingPageHref(basePath, currentParams, page + 1)}
          className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
        >
          Next
        </Link>
      )}
    </div>
  );
}
