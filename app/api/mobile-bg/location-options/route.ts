import { NextResponse } from 'next/server';
import { load } from 'cheerio';
import iconv from 'iconv-lite';

export const runtime = 'nodejs';

const SEARCH_PAGE_URL = 'https://www.mobile.bg/search/avtomobili-dzhipove';

function encodeSearchParamWin1251(value: string) {
  const bytes = iconv.encode(value, 'windows-1251');
  let result = '';
  for (const byte of bytes) {
    const isAlphaNum =
      (byte >= 0x30 && byte <= 0x39) ||
      (byte >= 0x41 && byte <= 0x5a) ||
      (byte >= 0x61 && byte <= 0x7a);
    const isSafe = byte === 0x2d || byte === 0x2e || byte === 0x5f || byte === 0x7e;
    if (isAlphaNum || isSafe) {
      result += String.fromCharCode(byte);
    } else {
      result += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return result;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = (searchParams.get('location') || '').trim();
    const url = location
      ? `${SEARCH_PAGE_URL}?sort=3&f17=${encodeSearchParamWin1251(location)}`
      : `${SEARCH_PAGE_URL}?sort=3`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to load location options' }, { status: 502 });
    }

    const html = iconv.decode(Buffer.from(await response.arrayBuffer()), 'windows-1251');
    const $ = load(html);
    const label = $('select[name="f18"]').closest('item').find('title').first().text().trim() || 'Населено място';
    const options = $('select[name="f18"] option').toArray().map((option) => ({
      value: ($(option).attr('value') || '').trim(),
      label: $(option).text().trim() || 'всички',
    }));

    return NextResponse.json({
      label,
      options: options.length > 0 ? options : [{ value: '', label: 'всички' }],
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load location options' }, { status: 500 });
  }
}
