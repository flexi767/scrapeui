export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const plain = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (plain) return `${plain[3]}.${plain[2]}.${plain[1].slice(2)}`;

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(2);
    return `${day}.${month}.${year}`;
  }

  return value;
}

export function formatDateInputValue(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function currentIsoTimestamp(): string {
  return new Date().toISOString();
}
