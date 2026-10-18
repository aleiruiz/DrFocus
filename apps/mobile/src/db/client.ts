import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

export const DB_NAME = 'drfocus.db';

export const sqlite = openDatabaseSync(DB_NAME, { enableChangeListener: true });
sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
export { schema };
