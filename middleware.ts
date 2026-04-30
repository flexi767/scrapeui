import { NextRequest, NextResponse } from "next/server";
import { getDealerByDomain } from "@/lib/query-modules/public";

// In-memory domain cache: domain → slug (null = no match)
const cache = new Map<string, string | null>();
const cacheExpiry = new Map<string, number>();
const CACHE_TTL_MS = 60_000;

function cachedDealerSlug(host: string): string | null {
  const now = Date.now();
  if (cache.has(host) && (cacheExpiry.get(host) ?? 0) > now) {
    return cache.get(host) ?? null;
  }
  const dealer = getDealerByDomain(host);
  const slug = dealer?.slug ?? null;
  cache.set(host, slug);
  cacheExpiry.set(host, now + CACHE_TTL_MS);
  return slug;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only consider root-level or unknown paths — skip known internal paths
  if (
    pathname.startsWith("/d/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/login") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const host = (request.headers.get("host") ?? "").split(":")[0]; // strip port
  const slug = cachedDealerSlug(host);
  if (!slug) return NextResponse.next();

  // Rewrite: keep the custom domain in the browser but serve /d/[slug]
  const url = request.nextUrl.clone();
  url.pathname = `/d/${slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// Force Node.js runtime so better-sqlite3 native module works
export const runtime = "nodejs";
