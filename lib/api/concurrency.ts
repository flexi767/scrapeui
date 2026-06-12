type Release = () => void;

export interface ConcurrencyGate {
  tryAcquire(): Release | null;
  activeCount(): number;
}

export function createConcurrencyGate(limit: number): ConcurrencyGate {
  let active = 0;
  const safeLimit = Math.max(1, Math.floor(limit));

  return {
    tryAcquire() {
      if (active >= safeLimit) return null;
      active += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active = Math.max(0, active - 1);
      };
    },
    activeCount() {
      return active;
    },
  };
}

export async function withConcurrencyGate<T>(
  gate: ConcurrencyGate,
  run: () => Promise<T>,
): Promise<T | Response> {
  const release = gate.tryAcquire();
  if (!release) {
    return Response.json(
      { error: "Server is busy. Please retry shortly." },
      { status: 429, headers: { "Retry-After": "10", "Cache-Control": "no-store" } },
    );
  }

  try {
    return await run();
  } finally {
    release();
  }
}
