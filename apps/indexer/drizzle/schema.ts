import { pgTable, serial, text, bigint, integer, timestamp } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const campaigns = pgTable("campaigns", {
	id: serial().primaryKey().notNull(),
	address: text().notNull(),
	creator: text().notNull(),
	goal: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	deadline: bigint({ mode: "number" }).notNull(),
	status: integer().default(0).notNull(),
	totalPledged: text("total_pledged").notNull(),
	metadataUri: text("metadata_uri").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdBlock: bigint("created_block", { mode: "number" }).notNull(),
});

export const checkpoints = pgTable("checkpoints", {
	id: serial().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	lastIndexedBlock: bigint("last_indexed_block", { mode: "number" }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});
