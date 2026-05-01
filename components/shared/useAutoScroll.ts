'use client';

import { useEffect, type RefObject } from 'react';

export function useAutoScroll<T extends HTMLElement>(ref: RefObject<T | null>, dependency: unknown) {
  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [dependency, ref]);
}
