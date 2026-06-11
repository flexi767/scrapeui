import path from 'path';
import { env } from '@/lib/env';

export const DB_PATH = env.DB_PATH ?? path.join(process.cwd(), '../scraped/listings.db');

export const SCRAPED_ROOT = path.dirname(DB_PATH);
export const CARIMG_DIR = path.join(SCRAPED_ROOT, 'carimg');
export const UPLOADS_DIR = path.join(SCRAPED_ROOT, 'uploads');
export const CRAWLEE_STORAGE_DIR = path.join(SCRAPED_ROOT, 'crawlee-storage');
