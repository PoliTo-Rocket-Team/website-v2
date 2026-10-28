-- Drops the deprecated column `members.email_alias` (issue #569,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/569).
--
-- Since issue #563 a member's team email alias lives in `prt_email`, and no
-- code reads or writes `email_alias` any more. Migration 0053 copied each
-- alias into an empty `prt_email`; the first statement below runs that same
-- guarded copy again, so an alias written after 0053 ran is not lost and a
-- `prt_email` already set is kept. Then the column is dropped.
--
-- Both steps run only while the column exists (issue #827,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/827): the shared
-- preview database had already lost the column without recording this
-- migration, so on a database without it this migration changes nothing.
-- These two statements are the only ones here, and
-- lib/seed/additive-migration.test.ts pins them.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'email_alias'
  ) THEN
    UPDATE "members" SET "prt_email" = "email_alias" WHERE "email_alias" IS NOT NULL AND ("prt_email" IS NULL OR "prt_email" = '');
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "members" DROP COLUMN IF EXISTS "email_alias";
