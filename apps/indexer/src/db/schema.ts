import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const checkpoints = sqliteTable('checkpoints', {
  id: text('id').primaryKey().notNull(), // factory:<address>
  block: integer('block', { mode: 'bigint' }),
  updatedAt: integer('updated_at').default(sql`(strftime('%s','now'))`),
});

export const campaigns = sqliteTable('campaigns', {
  address: text('address').primaryKey(),
  creator: text('creator').notNull(),
  goal: text('goal').notNull(),
  deadline: integer('deadline').notNull(),
  status: integer('status').notNull(),
  totalPledged: text('total_pledged').notNull(),
  metadataURI: text('metadata_uri').notNull(),
  createdAt: integer('created_at').notNull(),
  createdBlock: integer('created_block').notNull(),
  updatedAt: integer('updated_at').default(sql`(strftime('%s','now'))`),
});
