export async function readJsonBody<T>(
  request: Request,
  fallback: T | null = null,
): Promise<T | null> {
  return request.json().catch(() => fallback) as Promise<T | null>;
}
