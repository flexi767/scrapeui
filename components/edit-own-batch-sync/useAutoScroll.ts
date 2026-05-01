import { useEffect, type RefObject } from 'react';

export function useAutoScroll<T>(ref: RefObject<HTMLElement | null>, dependency: T) {
  useEffect(() => {
    if (!ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [dependency, ref]);
}
