CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"creator" text NOT NULL,
	"goal" text NOT NULL,
	"deadline" bigint NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"total_pledged" text NOT NULL,
	"metadata_uri" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_block" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_indexed_block" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
