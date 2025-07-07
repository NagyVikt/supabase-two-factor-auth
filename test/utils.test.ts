import { describe, it, expect } from 'vitest';
import { cn } from '../lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('deduplicates tailwind classes', () => {
    const result = cn('p-2', 'p-4');
    expect(result).toBe('p-4');
  });
});
