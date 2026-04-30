import type { MakeEntry } from "@/lib/mobile-bg/makes-models";
import type { City } from "@/lib/mobile-bg/regions";
import type {
  FormState,
  PrefillResponse,
} from "@/components/new-listing-form/constants";

export interface SaveDraftResponse {
  id?: number;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

async function parseJsonResponse<T>(response: Response, fallbackError: string) {
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || fallbackError);
  }
  return payload as T;
}

export async function fetchCities(regionValue: string) {
  const response = await fetch(
    `/api/mobile-bg/cities?region=${encodeURIComponent(regionValue)}`,
  );
  return (await response.json()) as City[];
}

export async function fetchMakes(pubtype: string) {
  const response = await fetch(
    `/api/mobile-bg/makes?pubtype=${encodeURIComponent(pubtype)}`,
  );
  return (await response.json()) as MakeEntry[];
}

export async function createDraft(form: FormState) {
  const response = await fetch("/api/editown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  return parseJsonResponse<SaveDraftResponse>(response, "Грешка при запазване.");
}

export async function updateDraft(backupId: number, form: FormState) {
  const response = await fetch(`/api/editown/backups/${backupId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  return parseJsonResponse<SaveDraftResponse>(
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
  return parseJsonResponse<PrefillResponse>(
    response,
    "Грешка при зареждане на обявата.",
  );
}

export async function deleteDraftById(backupId: number) {
  const response = await fetch(`/api/editown/backups/${backupId}`, {
    method: "DELETE",
  });
  await parseJsonResponse(response, "Грешка при изтриване на черновата.");
}
