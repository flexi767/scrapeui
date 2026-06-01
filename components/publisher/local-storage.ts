import { parseJson } from "@/lib/utils";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function getLocalStorageItem(key: string): string | null {
  return getStorage()?.getItem(key) ?? null;
}

export function setLocalStorageItem(key: string, value: string) {
  getStorage()?.setItem(key, value);
}

export function removeLocalStorageItem(key: string) {
  getStorage()?.removeItem(key);
}

export function getLocalStorageJson<T>(key: string, fallback: T): T {
  return parseJson(getLocalStorageItem(key), fallback);
}

export function setLocalStorageJson(key: string, value: unknown) {
  setLocalStorageItem(key, JSON.stringify(value));
}
