import type { Page } from "playwright";

interface ListPageCrawler {
  addRequests(requests: Array<{ url: string; label: string }>): Promise<unknown>;
}

export async function enqueueNextListPage({
  crawler,
  page,
  currentUrl,
  baseUrl,
  maxPages,
}: {
  crawler: ListPageCrawler;
  page: Page;
  currentUrl: string;
  baseUrl: string;
  maxPages: number;
}): Promise<void> {
  const currentPage = parseInt(new URL(currentUrl).searchParams.get("page") || "1", 10);
  if (currentPage >= maxPages) return;

  const hasNext = await page.evaluate(
    (nextPage: number) =>
      Array.from(document.querySelectorAll("a")).some(
        (a) =>
          a.href.includes(`page=${nextPage}`) ||
          a.textContent?.trim() === String(nextPage),
      ),
    currentPage + 1,
  );

  if (!hasNext) return;

  const nextUrl = new URL(baseUrl);
  nextUrl.searchParams.set("page", String(currentPage + 1));
  await crawler.addRequests([{ url: nextUrl.toString(), label: "LIST" }]);
}
