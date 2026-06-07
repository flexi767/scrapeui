
import { headers } from "next/headers";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BookmarkletLink } from "@/components/facebook-marketplace/BookmarkletLink";

export default async function FacebookMarketplaceBookmarkletPage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const source = await readFile(join(process.cwd(), "public/bookmarklets/facebook-marketplace.js"), "utf8");
  const bookmarkletScript = source
    .replace('"__SCRAPEUI_ORIGIN__"', JSON.stringify(origin))
    .replace(/\s*\n\s*/g, " ")
    .trim();
  const bookmarklet = `javascript:${bookmarkletScript}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Facebook Marketplace Bookmarklet</h1>
        <p className="mt-1 text-sm text-gray-400">
          Runs scrapeui listing selection inside the currently open Marketplace tab.
        </p>
      </div>

      <section className="rounded-lg border border-gray-700 bg-gray-900/50 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <BookmarkletLink bookmarklet={bookmarklet} />
          <span className="text-sm text-gray-400">
            Drag this link to the bookmarks bar.
          </span>
        </div>

        <div className="mt-5 space-y-2 text-sm text-gray-300">
          <p>Open Facebook Marketplace, then click the bookmark.</p>
          <p>The bookmark opens a scrapeui picker popup, sends your chosen listing back to Facebook, fills the form, and leaves publishing to you.</p>
        </div>
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-900/50 p-5">
        <h2 className="text-sm font-semibold text-white">Bookmark URL</h2>
        <textarea
          readOnly
          value={bookmarklet}
          rows={5}
          className="mt-3 w-full rounded-md border border-gray-700 bg-gray-950 p-3 font-mono text-xs text-gray-300"
        />
      </section>
    </div>
  );
}
