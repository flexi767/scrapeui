import { headers } from "next/headers";
import { BookmarkletLink } from "@/components/facebook-marketplace/BookmarkletLink";

export default async function FacebookMarketplaceBookmarkletPage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const bookmarklet = `javascript:(()=>{const s=document.createElement('script');s.src='${origin}/api/facebook-marketplace/bookmarklet?ts='+Date.now();document.body.appendChild(s);})()`;

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
          <p>Open Facebook Marketplace create vehicle listing, then click the bookmark.</p>
          <p>The overlay loads recent own listings, lets you choose one, fills the form, and leaves publishing to you.</p>
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
