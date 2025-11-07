import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const dbFile = new URL('../../../../data/app.db', import.meta.url).pathname;

const sqlite = new Database(dbFile);
export const db = drizzle(sqlite, { schema });
