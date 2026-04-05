import { getVatFromMobileBgLabel, type VatValue } from '@/lib/vat';
import { load, type Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { execFile } from 'child_process';
import iconv from 'iconv-lite';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface MobileBgSearchFieldInput {
  name: string;
  value: string;
}

export interface MobileBgSearchResultRow {
  mobile_id: string;
  original_position: number;
  url: string;
  thumb: string | null;
  title: string;
  make: string | null;
  model: string | null;
  dealer_name: string | null;
  dealer_url: string | null;
  current_price: number | null;
  vat_status: VatValue | null;
  ad_status: string;
  reg_month: string | null;
  reg_year: string | null;
  body_type: string | null;
  fuel: string | null;
  mileage: number | null;
  transmission: string | null;
  power: number | null;
}

export interface MobileBgSearchResultsPayload {
  submitted_fields: MobileBgSearchFieldInput[];
  summary_text: string | null;
  page: number;
  total_pages: number | null;
  has_next_page: boolean;
  count_on_page: number;
  loaded_until_page: number;
  ignored_search_result_ids?: string[];
  rows: MobileBgSearchResultRow[];
  fallback_note?: string | null;
}

interface MobileBgSearchResultsPagePayload extends MobileBgSearchResultsPayload {
  next_page_url: string | null;
}

export interface MobileBgSearchResultsUntilFoundPayload extends MobileBgSearchResultsPayload {
  found_on_page: number | null;
}

const FUEL_OPTIONS = new Set([
  'Бензинов',
  'Дизелов',
  'Електрически',
  'Хибриден',
  'Plug-in хибрид',
  'Газ',
  'Водород',
]);

const TRANSMISSION_OPTIONS = new Set([
  'Ръчна',
  'Автоматична',
  'Полуавтоматична',
]);

const BODY_TYPE_OPTIONS = new Set([
  'Ван',
  'Джип',
  'Кабрио',
  'Комби',
  'Купе',
  'Миниван',
  'Пикап',
  'Седан',
  'Стреч лимузина',
  'Хечбек',
]);

const SORT_LABELS: Record<string, string> = {
  '1': 'Марка/Модел/Цена',
  '3': 'Цена',
  '4': 'Дата на производство',
  '5': 'Пробег',
  '6': 'Най-новите обяви',
  '7': 'Най-новите обяви от посл. 2 дни',
};

function absoluteMobileBgUrl(url: string | undefined | null) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `https://www.mobile.bg${url}`;
  return url;
}

function encodeFormComponentWin1251(value: string) {
  const bytes = iconv.encode(value, 'windows-1251');
  let result = '';
  for (const byte of bytes) {
    const isAlphaNum =
      (byte >= 0x30 && byte <= 0x39) ||
      (byte >= 0x41 && byte <= 0x5a) ||
      (byte >= 0x61 && byte <= 0x7a);
    const isSafe = byte === 0x2d || byte === 0x2e || byte === 0x5f || byte === 0x2a;
    if (isAlphaNum || isSafe) {
      result += String.fromCharCode(byte);
    } else if (byte === 0x20) {
      result += '+';
    } else {
      result += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return result;
}

function buildWindows1251FormBody(fields: MobileBgSearchFieldInput[]) {
  return fields
    .map((field) => `${encodeFormComponentWin1251(field.name)}=${encodeFormComponentWin1251(field.value)}`)
    .join('&');
}

function decodeMobileBgHtml(raw: Buffer | Uint8Array | ArrayBuffer) {
  if (raw instanceof ArrayBuffer) return iconv.decode(Buffer.from(raw), 'windows-1251');
  return iconv.decode(Buffer.from(raw), 'windows-1251');
}

function parsePrice(priceText: string) {
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

function parseVatStatus(priceText: string, dealerName: string | null): VatValue | null {
  if (priceText.includes('Не се начислява ДДС')) return 'exempt';
  if (priceText.includes('Цената е без ДДС') || priceText.includes('без ДДС')) return 'excluded';
  if (priceText.includes('Цената е с включено ДДС')) return 'included';
  const vat = getVatFromMobileBgLabel(priceText);
  if (vat) return vat;
  if (!dealerName) return 'exempt';
  return null;
}

function parseYearAndMonth(raw: string) {
  const match = raw.match(/^([^\d]+?)\s+(\d{4})\s*г\.?$/i);
  if (!match) return { reg_month: null, reg_year: null };
  return {
    reg_month: match[1].trim() || null,
    reg_year: match[2] || null,
  };
}

function parseMileage(raw: string) {
  const match = raw.match(/([\d\s]+)\s*км/i);
  if (!match) return null;
  const value = Number.parseInt(match[1].replace(/\s+/g, ''), 10);
  return Number.isFinite(value) ? value : null;
}

function parsePower(raw: string) {
  const match = raw.match(/(\d[\d\s]*)\s*к\.с\./i);
  if (!match) return null;
  const value = Number.parseInt(match[1].replace(/\s+/g, ''), 10);
  return Number.isFinite(value) ? value : null;
}

function deriveMakeModel(title: string, submittedMake: string | null, submittedModel: string | null) {
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

function extractDealerName(item: Cheerio<Element>) {
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

function normalizeSummaryText(summaryText: string | null, submittedFields: MobileBgSearchFieldInput[]) {
  if (!summaryText) return null;
  const sortValue = submittedFields.find((field) => field.name === 'f20')?.value;
  const sortLabel = sortValue ? SORT_LABELS[sortValue] : null;
  const normalizedSummary = summaryText
    .replace(/Година на производство от:\s*/gu, 'Год.: ')
    .replace(/Година на производство до:\s*/gu, 'Год. до: ');
  if (!sortLabel) return normalizedSummary;
  return normalizedSummary.replace(/Подредени по:\s*[^,]+$/u, `Подредени по: ${sortLabel}`);
}

export async function fetchMobileBgSearchResults(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInput[],
  sourceMobileId?: string | null,
): Promise<MobileBgSearchResultsPayload> {
  return fetchMobileBgSearchResultsOnce(action, method, submittedFields, sourceMobileId);
}

async function fetchMobileBgSearchResultsOnce(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInput[],
  sourceMobileId?: string | null,
): Promise<MobileBgSearchResultsPayload> {
  const initial = await fetchMobileBgSearchResultsPage(action, method, submittedFields);

  if (
    sourceMobileId &&
    initial.has_next_page &&
    initial.next_page_url &&
    !initial.rows.some((row) => row.mobile_id === sourceMobileId)
  ) {
    const secondPage = await fetchMobileBgSearchResultsPage(initial.next_page_url, 'get', submittedFields);
    const dedupedSecondRows = secondPage.rows.filter(
      (row) => !initial.rows.some((existingRow) => existingRow.mobile_id === row.mobile_id),
    );

    return {
      ...initial,
      has_next_page: secondPage.has_next_page,
      total_pages: secondPage.total_pages ?? initial.total_pages,
      count_on_page: initial.count_on_page + dedupedSecondRows.length,
      loaded_until_page: secondPage.page,
      rows: [...initial.rows, ...dedupedSecondRows.map((row) => ({
        ...row,
        original_position: initial.rows.length + row.original_position,
      }))],
    };
  }

  return initial;
}

async function fetchMobileBgSearchResultsPage(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInput[],
): Promise<MobileBgSearchResultsPagePayload> {
  const requestBody = buildWindows1251FormBody(submittedFields);
  const curlArgs = ['-sS', '-L', '--http1.1'];

  if (method.toUpperCase() === 'POST') {
    curlArgs.push(
      '-X',
      'POST',
      action,
      '-H',
      'Content-Type: application/x-www-form-urlencoded; charset=windows-1251',
      '-H',
      'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      '--data-binary',
      requestBody,
    );
  } else {
    curlArgs.push(
      action,
      '-H',
      'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    );
  }

  const { stdout } = await execFileAsync('curl', curlArgs, {
    encoding: 'buffer',
    maxBuffer: 10 * 1024 * 1024,
  });

  const html = decodeMobileBgHtml(stdout);
  const $ = load(html);

  const submittedMake = submittedFields.find((field) => field.name === 'marka')?.value || null;
  const submittedModel = submittedFields.find((field) => field.name === 'model')?.value || null;

  const rows: MobileBgSearchResultRow[] = $('.ads2023 .item').map((index, element) => {
    const item = $(element);
    const titleLink = item.find('.zaglavie a.title').first();
    const rawUrl = titleLink.attr('href') || item.find('a.image').first().attr('href') || '';
    const url = absoluteMobileBgUrl(rawUrl);
    const mobileId = url.match(/obiava-(\d+)/)?.[1] || item.attr('id')?.replace(/^ida/, '') || '';
    const title = titleLink.text().trim();
    const priceText = item.find('.zaglavie .price').first().text();
    const params = item.find('.params span').map((__, span) => $(span).text().trim()).get().filter(Boolean);
    const thumb = absoluteMobileBgUrl(item.find('.photo .big img.pic').attr('src') || item.find('.photo .big img').last().attr('src') || '');
    const dealer = extractDealerName(item);
    const status = item.hasClass('TOP') ? 'TOP' : item.hasClass('VIP') ? 'VIP' : 'none';
    const yearMonth = parseYearAndMonth(params[0] || '');
    const mileage = params.map(parseMileage).find((value) => value != null) ?? null;
    const fuel = params.find((value) => FUEL_OPTIONS.has(value)) || null;
    const transmission = params.find((value) => TRANSMISSION_OPTIONS.has(value)) || null;
    const bodyType = params.find((value) => BODY_TYPE_OPTIONS.has(value)) || null;
    const power = params.map(parsePower).find((value) => value != null) ?? null;
    const makeModel = deriveMakeModel(title, submittedMake, submittedModel);

    return {
      mobile_id: mobileId,
      original_position: index + 1,
      url,
      thumb: thumb || null,
      title,
      make: makeModel.make,
      model: makeModel.model,
      dealer_name: dealer.dealer_name,
      dealer_url: dealer.dealer_url,
      current_price: parsePrice(priceText),
      vat_status: parseVatStatus(priceText, dealer.dealer_name),
      ad_status: status,
      reg_month: yearMonth.reg_month,
      reg_year: yearMonth.reg_year,
      body_type: bodyType,
      fuel,
      mileage,
      transmission,
      power,
    };
  }).get().filter((row) => {
    return Boolean(
      row.mobile_id &&
      row.url.includes('/obiava-') &&
      row.title.trim(),
    );
  });

  const currentPage = Number.parseInt($('.pagination .selected').first().text().trim(), 10) || 1;
  const numericPages = $('.pagination a, .pagination div')
    .map((_, element) => {
      const text = $(element).text().trim();
      const parsed = Number.parseInt(text, 10);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .get()
    .filter((value): value is number => value != null);

  const totalPages = numericPages.length > 0 ? Math.max(...numericPages) : null;
  const nextPageLink = $('.pagination a.next').first().attr('href') || null;
  const hasNextPage = Boolean(nextPageLink);

  return {
    submitted_fields: submittedFields,
    summary_text: normalizeSummaryText($('.resultsInfoBox #paramsFromSearchText').first().text().trim() || null, submittedFields),
    page: currentPage,
    total_pages: totalPages,
    has_next_page: hasNextPage,
    count_on_page: rows.length,
    loaded_until_page: currentPage,
    rows,
    next_page_url: absoluteMobileBgUrl(nextPageLink),
  };
}

export async function fetchMobileBgSearchResultsWithFallback(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInput[],
  sourceMobileId?: string | null,
): Promise<MobileBgSearchResultsPayload> {
  const initial = await fetchMobileBgSearchResultsOnce(action, method, submittedFields, sourceMobileId);
  if (initial.count_on_page > 0) return initial;

  const relaxedFields = submittedFields.filter((field) => !['f12', 'f13', 'f14'].includes(field.name));
  if (relaxedFields.length === submittedFields.length) return initial;

  const relaxed = await fetchMobileBgSearchResultsOnce(action, method, relaxedFields, sourceMobileId);
  if (relaxed.count_on_page === 0) return initial;

  return {
    ...relaxed,
    fallback_note: 'No results were returned with engine, gearbox, and body type applied, so those three filters were relaxed for the in-app preview.',
  };
}

async function fetchMobileBgSearchResultsUntilFoundOnce(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInput[],
  sourceMobileId: string,
): Promise<MobileBgSearchResultsUntilFoundPayload> {
  const firstPage = await fetchMobileBgSearchResultsPage(action, method, submittedFields);
  const rows = [...firstPage.rows];
  let nextPageUrl = firstPage.next_page_url;
  let hasNextPage = firstPage.has_next_page;
  let totalPages = firstPage.total_pages;
  let foundOnPage = rows.some((row) => row.mobile_id === sourceMobileId) ? firstPage.page : null;

  while (!foundOnPage && hasNextPage && nextPageUrl) {
    const nextPage = await fetchMobileBgSearchResultsPage(nextPageUrl, 'get', submittedFields);
    const dedupedRows = nextPage.rows
      .filter((row) => !rows.some((existingRow) => existingRow.mobile_id === row.mobile_id))
      .map((row) => ({
        ...row,
        original_position: rows.length + row.original_position,
      }));

    rows.push(...dedupedRows);
    if (dedupedRows.some((row) => row.mobile_id === sourceMobileId)) {
      foundOnPage = nextPage.page;
    }

    nextPageUrl = nextPage.next_page_url;
    hasNextPage = nextPage.has_next_page;
    totalPages = nextPage.total_pages ?? totalPages;
  }

  return {
    submitted_fields: submittedFields,
    summary_text: firstPage.summary_text,
    page: firstPage.page,
    total_pages: totalPages,
    has_next_page: hasNextPage,
    count_on_page: rows.length,
    loaded_until_page: foundOnPage ?? firstPage.page,
    rows,
    found_on_page: foundOnPage,
  };
}

export async function fetchMobileBgSearchResultsUntilFound(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInput[],
  sourceMobileId: string,
): Promise<MobileBgSearchResultsUntilFoundPayload> {
  const initial = await fetchMobileBgSearchResultsUntilFoundOnce(action, method, submittedFields, sourceMobileId);
  if (initial.count_on_page > 0) return initial;

  const relaxedFields = submittedFields.filter((field) => !['f12', 'f13', 'f14'].includes(field.name));
  if (relaxedFields.length === submittedFields.length) return initial;

  const relaxed = await fetchMobileBgSearchResultsUntilFoundOnce(action, method, relaxedFields, sourceMobileId);
  if (relaxed.count_on_page === 0) return initial;

  return {
    ...relaxed,
    fallback_note: 'No results were returned with engine, gearbox, and body type applied, so those three filters were relaxed for the in-app preview.',
  };
}
