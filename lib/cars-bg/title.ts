export const CARS_BG_TITLE_MAX_LENGTH = 15;

export function normalizeCarsBgShortTitle(value: string | null | undefined): string {
  return String(value ?? '').trim().slice(0, CARS_BG_TITLE_MAX_LENGTH);
}
