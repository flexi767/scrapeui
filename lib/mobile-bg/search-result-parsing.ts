import { getVatFromMobileBgLabel, type VatValue } from '@/lib/vat';
import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';

const SORT_LABELS: Record<string, string> = {
  '1': 'Марка/Модел/Цена',
  '3': 'Цена',
  '4': 'Дата на производство',
  '5': 'Пробег',
  '6': 'Най-новите обяви',
  '7': 'Най-новите обяви от посл. 2 дни',
};

export function absoluteMobileBgUrl(url: string | undefined | null) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `https://www.mobile.bg${url}`;
  return url;
}

export function parseMobileBgSearchPrice(priceText: string) {
  const match = priceText.match(/([\d\s.,]+)€/);
  if (!match) return null;
  const normalized = match[1]
    .trim()
    .replace(/\s+/g, '')
    .replace(/,(?=\d{2}$)/, '.')
    .replace(/,/g, '');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

export function parseMobileBgSearchVatStatus(priceText: string, dealerName: string | null): VatValue | null {
  if (priceText.includes('Не се начислява ДДС')) return 'exempt';
  if (priceText.includes('Цената е без ДДС') || priceText.includes('без ДДС')) return 'excluded';
  if (priceText.includes('Цената е с включено ДДС')) return 'included';
  const vat = getVatFromMobileBgLabel(priceText);
  if (vat) return vat;
  if (!dealerName) return 'exempt';
  return null;
}

export function parseMobileBgSearchYearAndMonth(raw: string) {
  const match = raw.match(/^([^\d]+?)\s+(\d{4})\s*г\.?$/i);
  if (!match) return { reg_month: null, reg_year: null };
  return {
    reg_month: match[1].trim() || null,
    reg_year: match[2] || null,
  };
}

export function parseMobileBgSearchMileage(raw: string) {
  const match = raw.match(/([\d\s]+)\s*км/i);
  if (!match) return null;
  const value = Number.parseInt(match[1].replace(/\s+/g, ''), 10);
  return Number.isFinite(value) ? value : null;
}

export function parseMobileBgSearchPower(raw: string) {
  const match = raw.match(/(\d[\d\s]*)\s*к\.с\./i);
  if (!match) return null;
  const value = Number.parseInt(match[1].replace(/\s+/g, ''), 10);
  return Number.isFinite(value) ? value : null;
}

export function deriveMobileBgSearchMakeModel(
  title: string,
  submittedMake: string | null,
  submittedModel: string | null,
) {
  const trimmedTitle = title.trim();
  const loweredTitle = trimmedTitle.toLowerCase();
  const make = submittedMake?.trim() || null;
  const model = submittedModel?.trim() || null;

  if (make && model) {
    const combined = `${make} ${model}`.toLowerCase();
    if (loweredTitle.startsWith(combined)) return { make, model };
  }

  if (make && loweredTitle.startsWith(make.toLowerCase())) {
    const remainder = trimmedTitle.slice(make.length).trim();
    const derivedModel = remainder.split('/')[0]?.trim() || model || null;
    return { make, model: derivedModel };
  }

  return { make, model };
}

export function extractMobileBgSearchDealerName(item: Cheerio<Element>) {
  const dealerLink = item.find('.seller .name a').first();
  const linkedName = dealerLink.text().trim();
  if (linkedName) {
    return {
      dealer_name: linkedName,
      dealer_url: absoluteMobileBgUrl(dealerLink.attr('href') || '') || null,
    };
  }

  const logoAlt = item.find('.seller .logo img').first().attr('alt')?.trim() || '';
  const normalizedLogoName = logoAlt.replace(/^лого\s+/i, '').trim();
  if (normalizedLogoName && normalizedLogoName !== 'Регион:') {
    return {
      dealer_name: normalizedLogoName,
      dealer_url: null,
    };
  }

  return {
    dealer_name: null,
    dealer_url: null,
  };
}

export function normalizeMobileBgSearchSummaryText(
  summaryText: string | null,
  submittedFields: Array<{ name: string; value: string }>,
) {
  if (!summaryText) return null;
  const sortValue = submittedFields.find((field) => field.name === 'f20')?.value;
  const sortLabel = sortValue ? SORT_LABELS[sortValue] : null;
  const normalizedSummary = summaryText
    .replace(/Година на производство от:\s*/gu, 'Год.: ')
    .replace(/Година на производство до:\s*/gu, 'Год. до: ');
  if (!sortLabel) return normalizedSummary;
  return normalizedSummary.replace(/Подредени по:\s*[^,]+$/u, `Подредени по: ${sortLabel}`);
}

