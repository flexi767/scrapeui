import { parseApiResponse } from "@/lib/utils";

export async function setIgnoredSearchResult({
  sourceListingId,
  mobileId,
  ignored,
}: {
  sourceListingId: number;
  mobileId: string;
  ignored: boolean;
}) {
  const res = await fetch(`/api/listings/by-id/${sourceListingId}/ignored-search-results`, {
    method: ignored ? "POST" : "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ignoredMobileId: mobileId }),
  });
  await parseApiResponse<unknown>(res, "Failed to update ignored search result");
}

export async function saveAdAsCarbrosDraft(url: string) {
  const res = await fetch("/api/editown/save-ad", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, dealerSlug: "carbros" }),
  });
  const payload = await parseApiResponse<{ backupId?: number }>(res, "Failed to save ad as draft");

  if (typeof payload.backupId !== "number") {
    throw new Error("Failed to save ad as draft");
  }

  return payload.backupId;
}
