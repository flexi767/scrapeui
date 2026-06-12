import { describe, expect, it } from 'vitest';
import { appendBounded, tailRenderWindow } from '@/components/shared/render-window';

describe('render window helpers', () => {
  it('keeps arrays bounded when appending', () => {
    expect(appendBounded([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
    expect(appendBounded([1, 2], 3, 3)).toEqual([1, 2, 3]);
  });

  it('returns the tail window with hidden count metadata', () => {
    expect(tailRenderWindow([1, 2, 3, 4], 2)).toEqual({
      items: [3, 4],
      hiddenCount: 2,
      startIndex: 2,
    });
  });
});
