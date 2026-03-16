import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || '/Users/v/dev/scraped/listings.db',
  },
} satisfies Config;
