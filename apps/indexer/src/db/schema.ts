import { pgTable, serial, text, bigint, integer, timestamp } from 'drizzle-orm/pg-core';

export const campaigns = pgTable('campaigns', {
  id: serial('id').primaryKey(),
  address: text('address').notNull(),
  creator: text('creator').notNull(),
  goal: text('goal').notNull(),
  deadline: bigint('deadline', { mode: 'number' }).notNull(),
  status: integer('status').default(0).notNull(),
  totalPledged: text('total_pledged').notNull(),
  metadataURI: text('metadata_uri').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBlock: bigint('created_block', { mode: 'number' }).notNull(),
});

export const checkpoints = pgTable('checkpoints', {
  id: serial('id').primaryKey(),
  lastIndexedBlock: bigint('last_indexed_block', { mode: 'number' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
