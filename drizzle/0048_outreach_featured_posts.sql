-- Featured posts (Owner decision, issue #496). Featured is a setting on any
-- post, and at most two posts are featured at once. A featured post holds
-- one of two slots, 1 or 2, and each slot is held by one post at most, so
-- the database cannot store a third. The post pinned before (migration 0044,
-- the summit's story) takes slot 1, so it stays featured and no content is
-- lost. The one-pinned flag and its index go. The summit table stays as it
-- is; no code reads it any more.
ALTER TABLE "outreach_posts" ADD COLUMN "featured_slot" smallint;
--> statement-breakpoint
ALTER TABLE "outreach_posts" ADD CONSTRAINT "outreach_posts_featured_slot" CHECK ("outreach_posts"."featured_slot" in (1, 2));
--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_posts_featured_slot_unique" ON "outreach_posts" USING btree ("featured_slot");
--> statement-breakpoint
UPDATE "outreach_posts" SET "featured_slot" = 1 WHERE "pinned";
--> statement-breakpoint
DROP INDEX "outreach_posts_one_pinned";
--> statement-breakpoint
ALTER TABLE "outreach_posts" DROP COLUMN "pinned";
