/**
 * AES-256-GCM encryption/decryption for third-party account credentials stored
 * in the `dealers` table (mobile_password, cars_password, facebook_password,
 * instagram_password, tiktok_password).
 *
 * Key: 64 hex characters (32 bytes) supplied via CREDENTIALS_ENCRYPTION_KEY.
 *
 * Ciphertext format: enc:v1:<ivHex>:<authTagHex>:<cipherHex>
 *
 * decryptSecret is backward-compatible: values that do NOT start with "enc:v1:"
 * are returned unchanged, so rows that haven't been migrated yet still work.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw || raw.trim().length !== 64) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY must be set to a 64-hex-character string (32 bytes). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(raw.trim(), 'hex');
}

/**
 * Encrypt a plaintext credential string.
 * Returns null for null/empty input; otherwise returns the enc:v1: envelope.
 */
export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === '') return null;

  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a stored credential value.
 * - Returns null for null/empty input.
 * - Returns the value UNCHANGED if it does NOT start with "enc:v1:" (legacy
 *   plaintext rows remain usable until the backfill script is run).
 * - Otherwise decrypts and returns the plaintext string.
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored == null || stored === '') return null;

  // Backward compatibility: pass through unencrypted legacy values.
  if (!stored.startsWith(PREFIX)) return stored;

  const rest = stored.slice(PREFIX.length);
  const parts = rest.split(':');
  if (parts.length !== 3) {
    throw new Error(`decryptSecret: malformed enc:v1: envelope (expected 3 parts, got ${parts.length})`);
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
