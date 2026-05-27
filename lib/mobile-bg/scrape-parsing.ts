export function normalizeMobileDetailUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.endsWith('.mobile.bg') &&
      parsed.hostname !== 'www.mobile.bg'
    ) {
      parsed.hostname = 'www.mobile.bg';
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function parseMobileBgViewsCount(text: string | null): number | null {
  if (!text) return null;
  const match =
    text.match(/Прегледана:\s*([\d\s]+)/i) ||
    text.match(/Обявата е видяна\s+([\d\s]+)\s+пъти\.?/i);
  if (!match) return null;
  const normalized = match[1].replace(/\s+/g, '');
  const parsed = parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseMobileBgEuroPrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.replace(/\s/g, '').match(/([\d.,]+)€/);
  return match ? Math.round(parseFloat(match[1].replace(',', ''))) : null;
}

export function parseMobileBgVatStatus(text: string | null | undefined): string | null {
  const vatLower = (text || '').toLowerCase();
  if (
    vatLower.includes('не се начислява') ||
    vatLower.includes('частно лице') ||
    vatLower.includes('частна') ||
    vatLower.includes('освободена')
  ) {
    return 'exempt';
  }
  if (
    vatLower.includes('с включено ддс') ||
    vatLower.includes('с ддс') ||
    vatLower.includes('вкл')
  ) {
    return 'included';
  }
  if (vatLower.includes('без ддс')) return 'excluded';
  return null;
}

export function parseFirstInteger(text: string | null | undefined): number | null {
  if (!text) return null;
  return parseInt(String(text).replace(/\D/g, ''), 10) || null;
}

export function parseLabeledBodyText(bodyText: string, label: string): string | null {
  const match = bodyText.match(new RegExp(`${label}\\s*\\n\\s*(.+)`));
  return match ? match[1].trim() : null;
}

export function parseSingleWordLabel(bodyText: string, label: string): string | null {
  const rawValue = parseLabeledBodyText(bodyText, label);
  if (!rawValue) return null;
  const firstWord = rawValue.split(/[\s\[\](\n]/)[0];
  if (!firstWord || /\d/.test(firstWord)) return null;
  return firstWord;
}

export function parseMobileBgLastEdit(statistikiText: string | null | undefined): {
  isNew: boolean;
  lastEdit: string | null;
  views: number | null;
} {
  if (!statistikiText) return { isNew: false, lastEdit: null, views: null };
  const isNew = !statistikiText.startsWith('Редактирана');
  const dateMatch = statistikiText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  const timeMatch = statistikiText.match(/(\d{2}:\d{2})/);
  const lastEdit = dateMatch
    ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]} ${timeMatch ? timeMatch[1] : '00:00'}`
    : null;
  return {
    isNew,
    lastEdit,
    views: parseMobileBgViewsCount(statistikiText),
  };
}

