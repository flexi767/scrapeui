import util from "util";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { fetchMakesModels, type MakesMap } from "@/lib/mobile-bg/makes-models";
import { fetchFuelTypes } from "@/lib/mobile-bg/fuel-types";
import { fetchTransmissionTypes } from "@/lib/mobile-bg/transmission-types";

const _dir = fileURLToPath(new URL(".", import.meta.url));
export const DB_PATH =
  process.env.DB_PATH ||
  path.resolve(_dir, "../../../scraped/listings.db");

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
    downloadImages: args.includes("--download-images"),
    requestedSlugs: dealerArg ? dealerArg.split(",").map((s) => s.trim()) : [],
  };
}

export function openDb(dbPath?: string): Database.Database {
  const db = new Database(dbPath ?? DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export async function fetchRunnerRefData(overrides: { makesMap?: MakesMap | null } = {}): Promise<{
  makesMap: MakesMap | null;
  fuelMap: Map<string, string> | null;
  transmissionMap: Map<string, string> | null;
}> {
  const [makesMap, fuelMap, transmissionMap] = await Promise.all([
    overrides.makesMap !== undefined
      ? Promise.resolve(overrides.makesMap)
      : fetchMakesModels().catch(() => null),
    fetchFuelTypes().catch(() => null),
    fetchTransmissionTypes().catch(() => null),
  ]);
  return { makesMap, fuelMap, transmissionMap };
}
