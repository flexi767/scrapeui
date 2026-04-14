export function cleanDescription(text: string | null): string {
  if (!text) return "";
  const normalizedText = String(text)
    .replace(/\r\n/g, "\n")
    .replace(
      /Виж всички обяви в\s+[^\s]+\.bazar\.bg\s+и\s+[^\s]+\.mobile\.bg/giu,
      "",
    )
    .replace(/\n{3,}/g, "\n\n");
  const lines = normalizedText.split("\n");
  const start = lines.findIndex(
    (line) => line.trim() === "Допълнителна информация",
  );
  const trimmed = start === -1 ? lines : lines.slice(start + 4);
  const cleaned = trimmed.filter((line) => {
    const normalized = line.trim().toLowerCase();
    if (!normalized) return true;
    if (normalized.includes("виж всички обяви в")) return false;
    if (normalized.includes(".mobile.bg") || normalized.includes(".bazar.bg"))
      return false;
    return true;
  });
  return cleaned.join("\n").trim();
}
