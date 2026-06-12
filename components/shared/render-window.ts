export const DEFAULT_RENDER_WINDOW_SIZE = 300;

export function appendBounded<T>(
  items: readonly T[],
  item: T,
  maxItems = DEFAULT_RENDER_WINDOW_SIZE,
): T[] {
  if (items.length < maxItems) return [...items, item];
  return [...items.slice(items.length - maxItems + 1), item];
}

export function tailRenderWindow<T>(
  items: readonly T[],
  maxItems = DEFAULT_RENDER_WINDOW_SIZE,
): { items: readonly T[]; hiddenCount: number; startIndex: number } {
  if (items.length <= maxItems) {
    return { items, hiddenCount: 0, startIndex: 0 };
  }

  const hiddenCount = items.length - maxItems;
  return {
    items: items.slice(hiddenCount),
    hiddenCount,
    startIndex: hiddenCount,
  };
}
