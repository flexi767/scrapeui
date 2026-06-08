import { apiRequest } from "@/lib/utils";
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
  return apiRequest<City[]>(
    `/api/mobile-bg/cities?region=${encodeURIComponent(regionValue)}`,
    "Грешка при зареждане на градовете.",
  );
}

export async function fetchMakes(pubtype: string) {
  return apiRequest<MakeEntry[]>(
    `/api/mobile-bg/makes?pubtype=${encodeURIComponent(pubtype)}`,
    "Грешка при зареждане на марките.",
  );
}

export async function createDraft(form: FormState) {
  return apiRequest<SaveDraftResponse>("/api/editown", "Грешка при запазване.", {
    method: "POST",
    json: form,
  });
}

export async function updateDraft(backupId: number, form: FormState) {
  return apiRequest<SaveDraftResponse>(
    `/api/editown/backups/${backupId}`,
    "Грешка при запазване на промените.",
    { method: "PATCH", json: form },
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
  return apiRequest<PrefillResponse>(
    url,
    "Грешка при зареждане на обявата.",
  );
}

export async function deleteDraftById(backupId: number) {
  await apiRequest<unknown>(`/api/editown/backups/${backupId}`, "Грешка при изтриване на черновата.", {
    method: "DELETE",
  });
}
