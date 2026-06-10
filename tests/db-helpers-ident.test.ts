import { describe, it, expect } from 'vitest';
import { ident } from '@/lib/api/db-helpers';

describe('ident — SQL identifier guard', () => {
  it('passes through a simple lowercase identifier', () => {
    expect(ident('listings')).toBe('listings');
  });

  it('passes through a snake_case identifier', () => {
    expect(ident('mobile_id')).toBe('mobile_id');
  });

  it('passes through an identifier with digits after the first char', () => {
    expect(ident('col1')).toBe('col1');
  });

  it('passes through an underscore-prefixed identifier', () => {
    expect(ident('_internal')).toBe('_internal');
  });

  it('throws for SQL injection attempt', () => {
    expect(() => ident('a; DROP TABLE x')).toThrow();
  });

  it('throws for identifier with a hyphen', () => {
    expect(() => ident('col-name')).toThrow();
  });

  it('throws for identifier starting with a digit', () => {
    expect(() => ident('1col')).toThrow();
  });

  it('throws for empty string', () => {
    expect(() => ident('')).toThrow();
  });

  it('throws for identifier with uppercase letters', () => {
    expect(() => ident('MyTable')).toThrow();
  });
});
