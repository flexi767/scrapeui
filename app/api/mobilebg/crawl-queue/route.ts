import { NextRequest } from "next/server";
import { getMobileBgCrawlQueue } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const dealer = sp.getAll("dealer");
  const urlType = sp.get("url_type") ?? "";
  const status = sp.get("status") ?? "";
  const search = sp.get("search") ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(sp.get("limit") ?? "50", 10)),
  );

  const result = getMobileBgCrawlQueue({
    dealer,
    urlType,
    status,
    search,
    page,
    limit,
  });

  return Response.json(result);
}
