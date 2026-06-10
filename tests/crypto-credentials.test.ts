import { describe, it, expect, beforeAll } from 'vitest';
import { encryptSecret, decryptSecret } from '@/lib/crypto-credentials';

const FIXED_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = FIXED_KEY;
});

describe('encryptSecret', () => {
  it('returns null for null input', () => {
    expect(encryptSecret(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(encryptSecret(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(encryptSecret('')).toBeNull();
  });

  it('produces a string starting with enc:v1: for valid input', () => {
    const result = encryptSecret('hunter2');
    expect(result).toMatch(/^enc:v1:/);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const a = encryptSecret('hunter2');
    const b = encryptSecret('hunter2');
    expect(a).not.toEqual(b);
  });
});

describe('decryptSecret', () => {
  it('returns null for null input', () => {
    expect(decryptSecret(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(decryptSecret(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decryptSecret('')).toBeNull();
  });

  it('passes through legacy plaintext unchanged (no enc:v1: prefix)', () => {
    expect(decryptSecret('legacyplaintext')).toBe('legacyplaintext');
  });

  it('round-trips hunter2 correctly', () => {
    const encrypted = encryptSecret('hunter2')!;
    expect(decryptSecret(encrypted)).toBe('hunter2');
  });

  it('both ciphertexts of the same plaintext decrypt back correctly', () => {
    const a = encryptSecret('hunter2')!;
    const b = encryptSecret('hunter2')!;
    expect(decryptSecret(a)).toBe('hunter2');
    expect(decryptSecret(b)).toBe('hunter2');
  });

  it('round-trips an empty-ish value that is a real string', () => {
    const encrypted = encryptSecret('s3cr3t!')!;
    expect(decryptSecret(encrypted)).toBe('s3cr3t!');
  });
});
