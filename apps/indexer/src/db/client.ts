import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as tls from 'tls';
import * as schema from '@packages/db';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,
  } as tls.ConnectionOptions,
});

export const db = drizzle(pool, { schema });
