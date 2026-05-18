import { parseApiResponse } from "@/lib/utils";
import type { MakeEntry } from "@/lib/mobile-bg/makes-models";
import type { City } from "@/lib/mobile-bg/regions";
import type {
  FormState,
  PrefillResponse,
} from "@/components/new-listing-form/constants";

export interface SaveDraftResponse {
  id?: number;
}

export async function fetchCities(regionValue: string) {
  const response = await fetch(
    `/api/mobile-bg/cities?region=${encodeURIComponent(regionValue)}`,
  );
  return parseApiResponse<City[]>(response, "Грешка при зареждане на градовете.");
}

export async function fetchMakes(pubtype: string) {
  const response = await fetch(
    `/api/mobile-bg/makes?pubtype=${encodeURIComponent(pubtype)}`,
  );
  return parseApiResponse<MakeEntry[]>(response, "Грешка при зареждане на марките.");
}

export async function createDraft(form: FormState) {
  const response = await fetch("/api/editown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  return parseApiResponse<SaveDraftResponse>(response, "Грешка при запазване.");
}

export async function updateDraft(backupId: number, form: FormState) {
  const response = await fetch(`/api/editown/backups/${backupId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  return parseApiResponse<SaveDraftResponse>(
    response,
    "Грешка при запазване на промените.",
  );
}

export async function fetchListingPrefill({
  dealerId,
  mobileId,
  backupId,
}: {
  dealerId: string;
  mobileId: string;
  backupId: number | null;
}) {
  const url = mobileId
    ? `/api/editown/dealers/${encodeURIComponent(dealerId)}/listings/${encodeURIComponent(mobileId)}`
    : `/api/editown/backups/${backupId}`;
  const response = await fetch(url);
  return parseApiResponse<PrefillResponse>(
    response,
    "Грешка при зареждане на обявата.",
  );
}

export async function deleteDraftById(backupId: number) {
  const response = await fetch(`/api/editown/backups/${backupId}`, {
    method: "DELETE",
  });
  await parseApiResponse(response, "Грешка при изтриване на черновата.");
}
