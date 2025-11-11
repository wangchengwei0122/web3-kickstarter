import { pgTable, serial, text, bigint, integer, timestamp, unique } from 'drizzle-orm/pg-core';

export const campaigns = pgTable(
  'campaigns',
  {
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
  },
  (table) => ({
    addressUnique: unique().on(table.address), // address 字段唯一约束
  })
);

export const checkpoints = pgTable('checkpoints', {
  id: text('id').primaryKey(), // 使用文本 id，如 "factory:0x..."
  block: bigint('block', { mode: 'number' }), // 最后索引的区块号
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
