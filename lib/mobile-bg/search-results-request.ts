import { execFile } from 'child_process';
import iconv from 'iconv-lite';
import { promisify } from 'util';
import { parseJson } from '@/lib/utils';
import { absoluteMobileBgUrl } from '@/lib/mobile-bg/search-result-parsing';

const execFileAsync = promisify(execFile);
const MOBILE_BG_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

export interface MobileBgSearchFieldInputLike {
  name: string;
  value: string;
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

function buildWindows1251FormBody(fields: MobileBgSearchFieldInputLike[]) {
  return fields
    .map((field) => `${encodeFormComponentWin1251(field.name)}=${encodeFormComponentWin1251(field.value)}`)
    .join('&');
}

function decodeMobileBgHtml(raw: Buffer | Uint8Array | ArrayBuffer) {
  if (raw instanceof ArrayBuffer) return iconv.decode(Buffer.from(raw), 'windows-1251');
  return iconv.decode(Buffer.from(raw), 'windows-1251');
}

function ensureMobileBgSearchDefaults(submittedFields: MobileBgSearchFieldInputLike[]) {
  const byName = new Map(submittedFields.map((field) => [field.name, field.value]));
  if (!byName.has('f21')) {
    byName.set('f21', '013');
  }
  return Array.from(byName.entries()).map(([name, value]) => ({ name, value }));
}

async function resolveMobileBgSearchAction(
  action: string,
  submittedFields: MobileBgSearchFieldInputLike[],
) {
  if (!/mobile\.bg\/pcgi\/mobile\.cgi(?:$|\?)/i.test(action)) {
    return action;
  }

  const normalizedFields = ensureMobileBgSearchDefaults(submittedFields);
  const actsrc = normalizedFields.find((field) => field.name === 'act')?.value || '3';
  const rewriteFields = normalizedFields.map((field) =>
    field.name === 'act' ? { name: field.name, value: '11' } : field,
  );
  const requestBody = buildWindows1251FormBody([
    ...rewriteFields,
    { name: 'actsrc', value: actsrc },
  ]);

  const { stdout } = await execFileAsync(
    'curl',
    [
      '-sS',
      '-L',
      '--http1.1',
      '-X',
      'POST',
      'https://www.mobile.bg/pcgi/subscript.cgi',
      '-H',
      'Content-Type: application/x-www-form-urlencoded; charset=windows-1251',
      '-H',
      `User-Agent: ${MOBILE_BG_USER_AGENT}`,
      '--data-binary',
      requestBody,
    ],
    {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    },
  );

  const parsed = parseJson<{ result?: unknown }>(stdout, {});
  if (typeof parsed.result === 'string' && parsed.result.trim()) {
    return absoluteMobileBgUrl(parsed.result.trim());
  }

  return action;
}

export async function fetchMobileBgSearchResultsHtml(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInputLike[],
) {
  const normalizedFields = ensureMobileBgSearchDefaults(submittedFields);
  const resolvedAction =
    method.toUpperCase() === 'POST'
      ? await resolveMobileBgSearchAction(action, normalizedFields)
      : action;
  const requestBody = buildWindows1251FormBody(normalizedFields);
  const curlArgs = ['-sS', '-L', '--http1.1'];

  if (method.toUpperCase() === 'POST') {
    curlArgs.push(
      '-X',
      'POST',
      resolvedAction,
      '-H',
      'Content-Type: application/x-www-form-urlencoded; charset=windows-1251',
      '-H',
      `User-Agent: ${MOBILE_BG_USER_AGENT}`,
      '--data-binary',
      requestBody,
    );
  } else {
    curlArgs.push(
      resolvedAction,
      '-H',
      `User-Agent: ${MOBILE_BG_USER_AGENT}`,
    );
  }

  const { stdout } = await execFileAsync('curl', curlArgs, {
    encoding: 'buffer',
    maxBuffer: 10 * 1024 * 1024,
  });

  return {
    html: decodeMobileBgHtml(stdout),
    normalizedFields,
  };
}
