export function setCookie(
  name: string,
  value: string,
  days: number = 365,
): void {
  if (typeof document === 'undefined') return; // Skip on server

  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
}

export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined; // Skip on server

  const nameEQ = `${name}=`;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(nameEQ)) {
      return trimmed.substring(nameEQ.length);
    }
  }
  return undefined;
}
