"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

interface BookmarkletLinkProps {
  bookmarklet: string;
}

export function BookmarkletLink({ bookmarklet }: BookmarkletLinkProps) {
  const t = useTranslations('ui');
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    ref.current?.setAttribute("href", bookmarklet);
  }, [bookmarklet]);

  return (
    <a
      ref={ref}
      className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
    >
      {t('scrapeui_marketplace')}
    </a>
  );
}

