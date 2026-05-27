export interface MobileBgListCard {
  url: string;
  title: string;
  priceText: string;
  vatText: string | null;
  year: string | null;
  euronormText: string | null;
  mileage: string | null;
  color: string | null;
  fuel: string | null;
  transmission: string | null;
  adStatus: string;
  kaparo: boolean;
  imageCount: number;
  bodyType: string | null;
  thumb: string;
}

export interface MobileBgDetailExtract {
  priceText: string;
  vatText: string;
  bodyText: string;
  statistikiText: string;
  description: string;
  imgMeta: { cdn: string; shard: string } | null;
  thumbKeys: string[];
  fullKeys: string[];
  fullUrls: string[];
  firstThumbUrl: string;
  extras: string[];
}

export function extractMobileBgListCardsFromDocument(): MobileBgListCard[] {
  const homepageCategoryOptions = [
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
  ];

  return Array.from(document.querySelectorAll('a.title'))
    .map((a) => {
      const card = a.closest('.zaglavie') || a.parentElement;
      const item =
        a.closest('[class*="item"]') ||
        card?.closest('[class*="item"]');
      const itemClass = item?.className || '';
      const priceEl = card?.querySelector('.price');
      const priceWrapText = (
        priceEl?.parentElement?.textContent ||
        item?.textContent ||
        ''
      ).trim();
      const itemText = (item?.textContent || '').trim();
      const params = Array.from(item?.querySelectorAll('.params span') || [])
        .map((span) => span.textContent?.trim() || '')
        .filter(Boolean);
      const transmissionOptions = ['Ръчна', 'Автоматична', 'Полуавтоматична'];
      const transmissionIndex = params.findIndex((value) =>
        transmissionOptions.includes(value),
      );
      const year = params.find((value) => /\d{4}/.test(value)) || null;
      const euronormText =
        params.find((value) => /(?:евро|euro)\s*\d/i.test(value)) || null;
      const mileageIndex = params.findIndex((value) => /км/i.test(value));
      const mileage = mileageIndex !== -1 ? params[mileageIndex] : null;
      const color = mileageIndex !== -1 ? params[mileageIndex + 1] || null : null;
      const fuel =
        params.find((value) =>
          /(бенз|дизел|electric|електр|хибрид|газ|метан)/i.test(value),
        ) || null;
      const transmission = transmissionIndex !== -1 ? params[transmissionIndex] : null;
      const bodyType =
        params.find((value) => homepageCategoryOptions.includes(value)) ||
        (transmissionIndex !== -1 ? params[transmissionIndex + 1] || null : null);
      const vatText = /без ддс/i.test(priceWrapText)
        ? 'без ДДС'
        : /с включено ддс|с ддс|вкл\.?\s*ддс/i.test(priceWrapText)
          ? 'с ДДС'
          : /не се начислява ддс|частно лице|освободена/i.test(priceWrapText)
            ? 'не се начислява ДДС'
            : null;
      const adStatus = /\bTOP\b/i.test(itemClass)
        ? 'TOP'
        : /\bVIP\b/i.test(itemClass)
          ? 'VIP'
          : 'none';
      const kaparo = !!(
        a.closest('.kaparo') ||
        item?.querySelector('.kaparo') ||
        item?.classList?.contains('kaparo')
      );
      const imageCountMatch = itemText.match(/Повече детайли\s*и\s*(\d+)\s*снимк/i);
      const imageCount = imageCountMatch
        ? parseInt(imageCountMatch[1], 10) || 0
        : itemText.includes('Повече детайли')
          ? 1
          : 0;
      const allImgs = Array.from(item?.querySelectorAll('img') || []);
      const thumbImg = allImgs.find((i) => {
        const src =
          (i as HTMLImageElement).currentSrc ||
          (i as HTMLImageElement).src ||
          i.getAttribute('data-src') ||
          i.getAttribute('data-lazy') ||
          i.getAttribute('data-srcset') ||
          i.getAttribute('srcset') ||
          '';
        return src && !src.endsWith('.svg') && src.includes('photosorg');
      }) as HTMLImageElement | undefined;
      const thumb =
        thumbImg?.currentSrc ||
        thumbImg?.src ||
        thumbImg?.getAttribute('data-src') ||
        thumbImg?.getAttribute('data-lazy') ||
        thumbImg
          ?.getAttribute('data-srcset')
          ?.split(',')[0]
          ?.trim()
          .split(' ')[0] ||
        thumbImg
          ?.getAttribute('srcset')
          ?.split(',')[0]
          ?.trim()
          .split(' ')[0] ||
        '';
      return {
        url: (a as HTMLAnchorElement).href,
        title: a.textContent?.trim() || '',
        priceText: priceEl?.textContent?.trim() || '',
        vatText,
        year,
        euronormText,
        mileage,
        color,
        fuel,
        transmission,
        adStatus,
        kaparo,
        imageCount,
        bodyType,
        thumb,
      };
    })
    .filter((card) => card.url.includes('/obiava-'));
}

export function extractMobileBgDetailFromDocument(): MobileBgDetailExtract {
  const priceEl = document.querySelector('.Price');
  const priceText = (priceEl?.innerHTML || '')
    .split('<br>')[0]
    .replace(/<[^>]+>/g, '')
    .trim();
  const vatText = document.querySelector('.PriceInfo')?.textContent?.trim() || '';
  const statistikiText = (document.querySelector('.statistiki') as HTMLElement)?.innerText?.trim() || '';
  const description = (document.querySelector('.moreInfo') as HTMLElement)?.innerText?.trim() || '';
  const thumbUrls = Array.from(document.querySelectorAll('.smallPicturesGallery img'))
    .map((img) => (img as HTMLImageElement).src)
    .filter(Boolean);
  const fullUrls = Array.from(
    new Set(
      Array.from(document.querySelectorAll('.carouselimg, [class*=carousel] img'))
        .map((img) => (img as HTMLImageElement).src || img.getAttribute('data-src') || '')
        .filter((src) => src.includes('/big1/') && src.includes('.webp')),
    ),
  );
  const extras = Array.from(document.querySelectorAll('.carExtri .items div'))
    .map((el) => el.textContent?.trim() || '')
    .filter(Boolean);
  const parsedThumbs = thumbUrls.map((src) => {
    const match = src.match(/^https?:\/\/([^/]+)\/mobile\/photosorg\/\d+\/(\d+)\/(?:big1\/)?[^_]+_([^.]+)\.webp$/);
    return match ? { cdn: match[1], shard: match[2], key: match[3] } : null;
  });
  const parsedFull = fullUrls.map((src) => {
    const match = src.match(/^https?:\/\/([^/]+)\/mobile\/photosorg\/\d+\/(\d+)\/(?:big1\/)?[^_]+_([^.]+)\.webp$/);
    return match ? { cdn: match[1], shard: match[2], key: match[3] } : null;
  });
  const firstThumb = parsedThumbs.find(Boolean) || null;
  const imgMeta = firstThumb ? { cdn: firstThumb.cdn, shard: firstThumb.shard } : null;
  const thumbKeys = parsedThumbs.map((item) => item?.key).filter(Boolean) as string[];
  const fullKeys = parsedFull.map((item) => item?.key).filter(Boolean) as string[];
  return {
    priceText,
    vatText,
    bodyText: document.body.innerText.substring(0, 5000),
    statistikiText,
    description,
    imgMeta,
    thumbKeys,
    fullKeys,
    fullUrls,
    firstThumbUrl: thumbUrls[0] || '',
    extras,
  };
}
