import Link from "next/link";
import CrawlQueueFilterBar from "@/components/CrawlQueueFilterBar";
import { getAllDealers, getMobileBgCrawlQueue } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

interface SearchParams {
  dealer?: string | string[];
  url_type?: string | string[];
  status?: string | string[];
  search?: string;
  page?: string;
}

const URL_TYPES = ["dealer_homepage", "listing_detail"];
const STATUSES = ["pending", "in_progress", "completed", "failed"];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-700 text-gray-300",
    in_progress: "bg-blue-900 text-blue-200",
    completed: "bg-green-900 text-green-200",
    failed: "bg-red-900 text-red-200",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] || "bg-gray-700"}`}
    >
      {status}
    </span>
  );
}

function buildParams(
  dealerSlugs: string[],
  urlTypes: string[],
  statuses: string[],
  search: string,
  overrides: Record<string, string | string[] | undefined> = {},
) {
  const p = new URLSearchParams();

  for (const dealer of dealerSlugs) p.append("dealer", dealer);
  for (const urlType of urlTypes) p.append("url_type", urlType);
  for (const status of statuses) p.append("status", status);
  if (search) p.set("search", search);

  for (const [key, value] of Object.entries(overrides)) {
    p.delete(key);
    if (Array.isArray(value)) {
      for (const item of value) p.append(key, item);
    } else if (value) {
      p.set(key, value);
    }
  }

  p.delete("page");
  return p.toString();
}

export default async function CrawlQueuePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const dealerSlugs = sp.dealer
    ? Array.isArray(sp.dealer)
      ? sp.dealer
      : [sp.dealer]
    : [];
  const urlTypes = sp.url_type
    ? Array.isArray(sp.url_type)
      ? sp.url_type
      : [sp.url_type]
    : [];
  const statuses = sp.status
    ? Array.isArray(sp.status)
      ? sp.status
      : [sp.status]
    : [];
  const search = sp.search ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const { data: rows, total } = getMobileBgCrawlQueue({
    dealer: dealerSlugs,
    urlType: urlTypes,
    status: statuses,
    search,
    page,
    limit: 50,
  });
  const allDealers = getAllDealers();
  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-400 px-4 py-3">
          <h1 className="mb-3 text-xl font-semibold tracking-tight">
            Crawl Queue
          </h1>
          <CrawlQueueFilterBar
            allDealers={allDealers}
            urlTypes={URL_TYPES}
            statuses={STATUSES}
            total={total}
          />
        </div>
      </header>

      <main className="mx-auto max-w-400 px-4 py-4">
        <div className="overflow-x-auto rounded-lg border border-gray-700/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
                <th className="px-3 py-2 text-left">Dealer</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">URL / Mobile ID</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Ads</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Views</th>
                <th className="px-3 py-2 text-left">Last Crawled</th>
                <th className="px-3 py-2 text-left">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
                    No crawl queue entries found
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-800/30">
                  <td className="px-3 py-2 text-gray-200">
                    {row.dealer_slug ? (
                      <Link
                        href={`/mobilebg/crawl-queue?${buildParams(dealerSlugs, urlTypes, statuses, search, { dealer: [row.dealer_slug] })}`}
                        className="text-white hover:text-blue-400"
                      >
                        {row.dealer_name}
                      </Link>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    <span className="rounded bg-gray-700 px-2 py-0.5">
                      {row.url_type}
                    </span>
                  </td>
                  <td className="max-w-md px-3 py-2 text-gray-300 truncate">
                    {row.mobile_id ? (
                      <Link
                        href={`/listings/${row.mobile_id}`}
                        className="text-blue-400 hover:text-blue-300 block truncate"
                      >
                        {row.mobile_id}
                      </Link>
                    ) : (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 block truncate"
                      >
                        {row.url?.replace(/https?:\/\//, "")}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300">
                    {row.listings_count ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300">
                    {row.price ? `EUR ${row.price}` : "-"}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300">
                    {row.views ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    {row.last_crawled_at
                      ? formatDate(row.last_crawled_at)
                      : "-"}
                  </td>
                  <td
                    className="max-w-xs truncate px-3 py-2 text-xs text-red-400"
                    title={row.error || ""}
                  >
                    {row.error || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            {page > 1 && (
              <Link
                href={`/mobilebg/crawl-queue?${buildParams(dealerSlugs, urlTypes, statuses, search, { page: String(page - 1) })}`}
                className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
              >
                Prev
              </Link>
            )}
            <span className="text-gray-400">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/mobilebg/crawl-queue?${buildParams(dealerSlugs, urlTypes, statuses, search, { page: String(page + 1) })}`}
                className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
