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

/**
 * Run a server-side child-process action (createChildJobRoute endpoint) and
 * wait for its outcome. Resolves on a `result` event; throws on an `error`
 * event, a non-OK start response, or a stream that ends without a result.
 */
export async function runStreamedAction(
  url: string,
  json: unknown,
  fallbackError: string,
): Promise<void> {
  const response = await startJsonStream(url, { json });
  if (!response.ok || !response.body) {
    throw new Error(await readJsonError(response, fallbackError));
  }

  let succeeded = false;
  let failureMessage: string | null = null;
  await streamJsonEvents<{ type: string; message?: string }>(response, (event) => {
    if (event.type === 'result') succeeded = true;
    if (event.type === 'error') failureMessage = event.message ?? null;
  });

  if (!succeeded) {
    throw new Error(failureMessage ?? fallbackError);
  }
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
