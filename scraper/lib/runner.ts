import util from "util";

export function emit(obj: object) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

export function formatError(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  const e = err as Record<string, unknown>;
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev) return (e.message as string) || "Scrape failed";
  if (Array.isArray(e.errors) && e.errors.length > 0) {
    return e.errors.map(formatError).filter(Boolean).join(" | ");
  }
  if (e.cause) {
    const cause = formatError(e.cause);
    if (cause && cause !== e.message) return `${e.message}: ${cause}`;
  }
  if (e.message) return e.message as string;
  return util.inspect(err, { depth: 4, breakLength: 120 });
}

export function parseRunnerArgs(args = process.argv.slice(2)) {
  const dealersIdx = args.indexOf("--dealers");
  const dealerArg =
    dealersIdx !== -1 && args[dealersIdx + 1] ? args[dealersIdx + 1] : "";

  return {
    deepCrawl: args.includes("--deep"),
    requestedSlugs: dealerArg ? dealerArg.split(",").map((s) => s.trim()) : [],
  };
}
