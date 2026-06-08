export async function readJsonError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export function startJsonStream(
  url: string,
  {
    json,
    signal,
  }: {
    json?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<Response> {
  const headers = new Headers();
  const init: RequestInit = { method: 'POST', signal };

  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    init.headers = headers;
    init.body = JSON.stringify(json);
  }

  return fetch(url, init);
}

export async function stopJsonStream(url: string, fallback: string): Promise<void> {
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) throw new Error(await readJsonError(response, fallback));
}

export async function streamJsonEvents<T>(
  response: Response,
  onEvent: (event: T) => void,
): Promise<void> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith("data: ")) continue;

      try {
        onEvent(JSON.parse(line.slice(6)) as T);
      } catch {
        // Ignore malformed SSE lines so one bad chunk does not kill a run.
      }
    }
  }
}
