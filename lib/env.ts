/**
 * Validated, typed environment variables.
 * Import `env` for typed access or call `validateEnv()` at startup.
 *
 * TODO: the rest of the codebase reads process.env directly — migrate to `env.*` over time.
 */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  CREDENTIALS_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine(
      (val) => {
        // Only enforced when NODE_ENV is production.
        // In non-production the key may be absent.
        if (process.env.NODE_ENV !== 'production') return true;
        return typeof val === 'string' && /^[0-9a-f]{64}$/.test(val);
      },
      {
        message:
          'CREDENTIALS_ENCRYPTION_KEY must be a 64-character lowercase hex string in production',
      },
    ),
});

export type Env = z.infer<typeof schema>;

/**
 * Validate process.env against the schema.
 * Throws an Error listing every flattened issue (no secret values are printed).
 * Called once at server startup via instrumentation.ts.
 */
export function validateEnv(): Env {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.flatten();
    const lines: string[] = [];
    for (const [field, msgs] of Object.entries(issues.fieldErrors)) {
      lines.push(`  ${field}: ${(msgs as string[]).join(', ')}`);
    }
    for (const msg of issues.formErrors) {
      lines.push(`  (root): ${msg}`);
    }
    throw new Error(`Environment validation failed:\n${lines.join('\n')}`);
  }
  return result.data;
}

/** Parsed, typed env — available after validateEnv() has been called. */
export const env: Env = schema.parse(process.env);
