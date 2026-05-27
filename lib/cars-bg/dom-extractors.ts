export interface CarsBgListCardExtract {
  url: string;
  title: string;
  dateText: string;
  priceText: string;
  specsText: string;
  thumb: string;
}

export interface CarsBgDetailExtract {
  title: string;
  priceText: string;
  specsLine: string;
  description: string | null;
  ogImage: string;
  images: string[];
}

export interface CarsBgOwnerDetailExtract {
  carsTotalViews: number | null;
  carsImages: string[];
  description: string | null;
}

export function extractCarsBgOwnOfferIdsFromDocument(): string[] {
  return Array.from(document.querySelectorAll('[data-reference]'))
    .map((el) => (el.getAttribute('data-reference') || '').trim())
    .filter(Boolean);
}

function readOfferNotes(options?: { removeBoilerplate?: boolean }): string | null {
  const notesNode = document.querySelector('div.offer-notes');
  if (!notesNode) return null;
  const clone = notesNode.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  let text = (clone.textContent || '').replace(/\r/g, '');
  if (options?.removeBoilerplate) {
    text = text
      .replace(/Възможност за бартер/g, '')
      .replace(/Възможност за лизинг/g, '')
      .replace(/Възможност за данъчен кредит/g, '');
  }
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(options?.removeBoilerplate ? /\n{2,}/g : /\n{3,}/g, options?.removeBoilerplate ? '\n' : '\n\n')
    .trim() || null;
}

export function extractCarsBgOwnerDetailFromDocument(): CarsBgOwnerDetailExtract {
  const bodyText = document.body.innerText || '';
  const viewsMatch = bodyText.match(/Общо разглеждания:\s*([\d\s]+)/i);
  const carsTotalViews = viewsMatch
    ? Number.parseInt((viewsMatch[1] || '').replace(/[^\d]/g, ''), 10) || null
    : null;
  const carsImages = Array.from(document.querySelectorAll('img'))
    .map((img) => (img.getAttribute('src') || '').trim())
    .filter(Boolean);
  return {
    carsTotalViews,
    carsImages,
    description: readOfferNotes({ removeBoilerplate: true }),
  };
}

export function extractCarsBgListCardsFromDocument(): CarsBgListCardExtract[] {
  const results: CarsBgListCardExtract[] = [];
  const offerCards = document.querySelectorAll('#listContainer .offer');
  const seen = new Set<string>();

  for (const card of offerCards) {
    const a = card.querySelector('a[href*="/offer/"]');
    if (!a) continue;
    const href = (a as HTMLAnchorElement).href;
    if (seen.has(href) || !href.includes('/offer/')) continue;
    seen.add(href);

    const h5 = a.querySelector('h5');
    const title = h5?.textContent?.trim() || '';
    if (!title) continue;

    const dateNode = card.querySelector('.card__subtitle');
    const dateText = dateNode?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const priceNode = a.querySelector('.price');
    const priceText = priceNode?.textContent?.trim() || '';
    const specsNode = a.querySelector('.card__secondary.mdc-typography--body1');
    const specsText = specsNode?.textContent?.replace(/\s+/g, ' ').trim() || '';

    let thumb = '';
    const img = a.querySelector('img') as HTMLImageElement | null;
    const imgCandidates = [
      img?.currentSrc,
      img?.src,
      img?.getAttribute('src'),
      img?.getAttribute('data-src'),
      img?.getAttribute('data-lazy'),
      img?.getAttribute('data-original'),
    ];
    for (const candidate of imgCandidates) {
      if (!candidate) continue;
      try {
        thumb = new URL(candidate, location.href).href;
      } catch {
        thumb = candidate;
      }
      if (thumb) break;
    }

    if (!thumb) {
      const bgElements = [
        a.querySelector('.mdc-card__media') as HTMLElement | null,
        a.querySelector('[style*="background-image"]') as HTMLElement | null,
        a as HTMLElement,
      ].filter(Boolean) as HTMLElement[];

      for (const element of bgElements) {
        const bgCandidates = [
          element.style.backgroundImage,
          element.getAttribute('style') || '',
          getComputedStyle(element).backgroundImage,
        ];
        for (const candidate of bgCandidates) {
          const match = candidate.match(/url\(["']?(.*?)["']?\)/i);
          const raw = match?.[1];
          if (!raw) continue;
          try {
            thumb = new URL(raw, location.href).href;
          } catch {
            thumb = raw;
          }
          if (thumb) break;
        }
        if (thumb) break;
      }
    }

    results.push({ url: href, title, dateText, priceText, specsText, thumb });
  }

  return results;
}

export function extractCarsBgDetailFromDocument(): CarsBgDetailExtract {
  const h2 = document.querySelector('h2');
  const title = h2 ? h2.textContent?.trim() || '' : '';
  const body = document.body.innerText;
  const priceNode = document.querySelector('.offer-price');
  const priceText = priceNode?.textContent?.trim() || '';
  const specsMatch = body.match(/((?:Януари|Февруари|Март|Април|Май|Юни|Юли|Август|Септември|Октомври|Ноември|Декември)?\s*\d{4},.+?км\.?.*?)(?:\n|$)/);
  const specsLine = specsMatch ? specsMatch[1].trim() : '';
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  const images = [...document.querySelectorAll('img')]
    .map((img) => img.src)
    .filter((src) => src && src.includes('g1-bg.cars.bg') && Boolean(src.match(/\/20\d{2}/)));
  return {
    title,
    priceText,
    specsLine,
    description: readOfferNotes(),
    ogImage,
    images,
  };
}

