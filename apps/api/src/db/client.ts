/**
 * Drizzle + Supabase PostgreSQL 连接
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as tls from 'tls';
import * as schema from './schema.js';
import { env } from '../utils/env.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,
  } as tls.ConnectionOptions,
});

export const db = drizzle(pool, { schema });

