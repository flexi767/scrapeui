import { apiRequest } from "@/lib/utils";

export async function setIgnoredSearchResult({
  sourceListingId,
  mobileId,
  ignored,
}: {
  sourceListingId: number;
  mobileId: string;
  ignored: boolean;
}) {
  await apiRequest<unknown>(`/api/listings/by-id/${sourceListingId}/ignored-search-results`, "Failed to update ignored search result", {
    method: ignored ? "POST" : "DELETE",
    json: { ignoredMobileId: mobileId },
  });
}

export async function saveAdAsCarbrosDraft(url: string) {
  const payload = await apiRequest<{ backupId?: number }>("/api/editown/save-ad", "Failed to save ad as draft", {
    method: "POST",
    json: { url, dealerSlug: "carbros" },
  });

  if (typeof payload.backupId !== "number") {
    throw new Error("Failed to save ad as draft");
  }

  return payload.backupId;
}
