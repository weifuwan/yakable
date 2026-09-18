import { describe, expect, it } from 'vitest';

import { cx } from './cx';

describe('cx', () => {
  it('keeps truthy classes in order and removes empty values', () => {
    expect(cx('base', false, undefined, 'active', null, '')).toBe('base active');
  });
});
