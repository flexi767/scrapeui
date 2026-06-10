#!/usr/bin/env tsx
/**
 * One-off backfill: encrypts plaintext dealer credential passwords in the
 * `dealers` table using AES-256-GCM via the encryptSecret helper.
 *
 * Safe to run multiple times (idempotent): rows that already start with
 * "enc:v1:" are skipped.
 *
 * Requires CREDENTIALS_ENCRYPTION_KEY to be set in the environment (64 hex chars).
 *
 * Usage:
 *   CREDENTIALS_ENCRYPTION_KEY=<key> tsx scripts/encrypt-dealer-credentials.ts
 */

import { raw } from '@/db/client';
import { encryptSecret } from '@/lib/crypto-credentials';

const PASSWORD_COLUMNS = [
  'mobile_password',
  'cars_password',
  'facebook_password',
  'instagram_password',
  'tiktok_password',
] as const;

interface DealerCredRow {
  id: number;
  mobile_password: string | null;
  cars_password: string | null;
  facebook_password: string | null;
  instagram_password: string | null;
  tiktok_password: string | null;
}

function main() {
  const dealers = raw
    .prepare(
      `SELECT id, ${PASSWORD_COLUMNS.join(', ')}
       FROM dealers
       ORDER BY id`,
    )
    .all() as DealerCredRow[];

  let totalRows = 0;
  let totalEncrypted = 0;
  let totalSkipped = 0;

  for (const dealer of dealers) {
    totalRows++;
    const updates: string[] = [];
    const values: (string | null)[] = [];

    for (const col of PASSWORD_COLUMNS) {
      const value = dealer[col];
      if (!value || value.startsWith('enc:v1:')) {
        // Empty or already encrypted — skip this column.
        totalSkipped++;
        continue;
      }
      const encrypted = encryptSecret(value);
      updates.push(`${col} = ?`);
      values.push(encrypted);
      totalEncrypted++;
    }

    if (updates.length > 0) {
      raw
        .prepare(`UPDATE dealers SET ${updates.join(', ')} WHERE id = ?`)
        .run(...values, dealer.id);
      console.log(`[dealer ${dealer.id}] encrypted ${updates.length} column(s)`);
    }
  }

  console.log(
    `\nDone. Dealers processed: ${totalRows}. ` +
      `Columns encrypted: ${totalEncrypted}. ` +
      `Columns skipped (empty or already encrypted): ${totalSkipped}.`,
  );
}

main();
