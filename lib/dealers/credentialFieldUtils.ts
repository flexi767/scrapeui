export function createFieldMap<TKey extends string>(keys: TKey[]): Record<TKey, string> {
  return keys.reduce(
    (fields, field) => ({ ...fields, [field]: field }),
    {} as Record<TKey, string>,
  );
}

export function createEmptyFields<TKey extends string>(keys: TKey[]): Record<TKey, string> {
  return keys.reduce(
    (fields, field) => ({ ...fields, [field]: '' }),
    {} as Record<TKey, string>,
  );
}

export function pickStringFields<TKey extends string>(
  keys: TKey[],
  source: Record<TKey, string | null | undefined>,
): Record<TKey, string> {
  return keys.reduce(
    (fields, field) => ({ ...fields, [field]: source[field] ?? '' }),
    {} as Record<TKey, string>,
  );
}

export function pickNullableStringFields<TKey extends string>(
  keys: TKey[],
  source: Partial<Record<TKey, unknown>>,
): Record<TKey, string | null> {
  return keys.reduce(
    (fields, field) => {
      const value = source[field];
      return { ...fields, [field]: typeof value === 'string' ? value : null };
    },
    {} as Record<TKey, string | null>,
  );
}

export function getFieldValues<TKey extends string, TValue>(
  keys: TKey[],
  source: Record<TKey, TValue>,
): TValue[] {
  return keys.map((field) => source[field]);
}
