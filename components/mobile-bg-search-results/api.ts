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
  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((payload as { error?: string }).error || "Failed to update ignored search result");
  }
}

export async function saveAdAsCarbrosDraft(url: string) {
  const res = await fetch("/api/editown/save-ad", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, dealerSlug: "carbros" }),
  });
  const payload = await res.json().catch(() => ({})) as {
    backupId?: number;
    error?: string;
  };

  if (!res.ok || typeof payload.backupId !== "number") {
    throw new Error(payload.error || "Failed to save ad as draft");
  }

  return payload.backupId;
}
