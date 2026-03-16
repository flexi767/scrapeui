import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const dealers = sqliteTable('dealers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  mobileUrl: text('mobile_url'),
  own: integer('own').default(0),
  active: integer('active').default(1),
  priority: integer('priority').default(0),
  mobileUser: text('mobile_user'),
  mobilePassword: text('mobile_password'),
  carsUser: text('cars_user'),
  carsPassword: text('cars_password'),
  createdAt: text('created_at'),
});

export const listings = sqliteTable('listings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mobileId: text('mobile_id').unique(),
  dealerId: integer('dealer_id').references(() => dealers.id),
  url: text('url'),
  title: text('title'),
  make: text('make'),
  model: text('model'),
  regMonth: text('reg_month'),
  regYear: text('reg_year'),
  fuel: text('fuel'),
  color: text('color'),
  power: integer('power'),
  mileage: integer('mileage'),
  description: text('description'),
  adStatus: text('ad_status'),
  kaparo: integer('kaparo'),
  isNew: integer('is_new'),
  lastEdit: text('last_edit'),
  currentPrice: integer('current_price'),
  vat: text('vat'),
  imageCount: integer('image_count'),
  imageMeta: text('image_meta'),
  thumbKeys: text('thumb_keys'),
  fullKeys: text('full_keys'),
  imagesDownloaded: integer('images_downloaded').default(0),
  firstSeenAt: text('first_seen_at'),
  lastSeenAt: text('last_seen_at'),
  isActive: integer('is_active').default(1),
});

export const listingSnapshots = sqliteTable('listing_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  listingId: integer('listing_id').references(() => listings.id),
  price: integer('price'),
  vat: text('vat'),
  lastEdit: text('last_edit'),
  adStatus: text('ad_status'),
  kaparo: integer('kaparo'),
  title: text('title'),
  description: text('description'),
  recordedAt: text('recorded_at'),
});

export type Dealer = typeof dealers.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type ListingSnapshot = typeof listingSnapshots.$inferSelect;
