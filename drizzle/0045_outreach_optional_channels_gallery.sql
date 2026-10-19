-- Outreach posts (issue #430, Owner decision). A published post no longer
-- needs an Instagram or LinkedIn original: the channels check keeps only the
-- shape. A post version may carry a gallery, the carousel project pages have,
-- stored as `{ shown, title, items }` (lib/outreach-rows.ts reads it back);
-- null for a post that never had one. No row changes: every post stored
-- today has no gallery.
ALTER TABLE "outreach_post_versions" DROP CONSTRAINT "outreach_post_versions_channels";
--> statement-breakpoint
ALTER TABLE "outreach_post_versions" ADD CONSTRAINT "outreach_post_versions_channels" CHECK (jsonb_typeof("outreach_post_versions"."channels") = 'object');
--> statement-breakpoint
ALTER TABLE "outreach_post_versions" ADD COLUMN "gallery" jsonb;
--> statement-breakpoint
ALTER TABLE "outreach_post_versions" ADD CONSTRAINT "outreach_post_versions_gallery" CHECK ("outreach_post_versions"."gallery" is null or jsonb_typeof("outreach_post_versions"."gallery") = 'object');
