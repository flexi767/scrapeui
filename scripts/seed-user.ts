/**
 * Seed an admin user into the database.
 * Usage: npx tsx scripts/seed-user.ts [username] [password] [name]
 * Defaults: admin / admin / Admin
 */
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || '/Users/v/dev/scraped/listings.db';
const username = process.argv[2] || 'admin';
const password = process.argv[3] || 'admin';
const name = process.argv[4] || 'Admin';

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const hash = bcrypt.hashSync(password, 10);
const now = new Date().toISOString();

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (existing) {
  db.prepare('UPDATE users SET password_hash = ?, name = ?, role = ?, created_at = ? WHERE username = ?')
    .run(hash, name, 'admin', now, username);
  console.log(`Updated user "${username}" with new password`);
} else {
  db.prepare('INSERT INTO users (username, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(username, name, hash, 'admin', now);
  console.log(`Created admin user "${username}"`);
}

db.close();
