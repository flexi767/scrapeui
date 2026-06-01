import { load } from 'cheerio';
import {
  MOBILE_BG_CATEGORY_SET,
  MOBILE_BG_FUEL_SET,
  MOBILE_BG_TRANSMISSION_SET,
} from '@/lib/mobile-bg/search-field-config';
import {
  absoluteMobileBgUrl,
  deriveMobileBgSearchMakeModel,
  extractMobileBgSearchDealerName,
  normalizeMobileBgSearchSummaryText,
  parseMobileBgSearchMileage,
  parseMobileBgSearchPower,
  parseMobileBgSearchPrice,
  parseMobileBgSearchVatStatus,
  parseMobileBgSearchYearAndMonth,
} from '@/lib/mobile-bg/search-result-parsing';
import type {
  MobileBgSearchFieldInput,
  MobileBgSearchResultRow,
  MobileBgSearchResultsPagePayload,
} from '@/lib/mobile-bg/search-results-types';

export function parseMobileBgSearchResultsPage(
  html: string,
  normalizedFields: MobileBgSearchFieldInput[],
  submittedFields: MobileBgSearchFieldInput[],
): MobileBgSearchResultsPagePayload {
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
    const dealer = extractMobileBgSearchDealerName(item);
    const status = item.hasClass('TOP') ? 'TOP' : item.hasClass('VIP') ? 'VIP' : 'none';
    const yearMonth = parseMobileBgSearchYearAndMonth(params[0] || '');
    const mileage = params.map(parseMobileBgSearchMileage).find((value) => value != null) ?? null;
    const fuel = params.find((value) => MOBILE_BG_FUEL_SET.has(value)) || null;
    const transmission = params.find((value) => MOBILE_BG_TRANSMISSION_SET.has(value)) || null;
    const bodyType = params.find((value) => MOBILE_BG_CATEGORY_SET.has(value)) || null;
    const power = params.map(parseMobileBgSearchPower).find((value) => value != null) ?? null;
    const makeModel = deriveMobileBgSearchMakeModel(title, submittedMake, submittedModel);

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
      current_price: parseMobileBgSearchPrice(priceText),
      vat_status: parseMobileBgSearchVatStatus(priceText, dealer.dealer_name),
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
    submitted_fields: normalizedFields,
    summary_text: normalizeMobileBgSearchSummaryText($('.resultsInfoBox #paramsFromSearchText').first().text().trim() || null, normalizedFields),
    page: currentPage,
    total_pages: totalPages,
    has_next_page: hasNextPage,
    count_on_page: rows.length,
    loaded_until_page: currentPage,
    rows,
    next_page_url: absoluteMobileBgUrl(nextPageLink),
  };
}
