-- The Google account's own email on each linked account (epic #902,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/902; issue #906,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/906). A person may
-- link several Google accounts to one login, and Better Auth keeps no email on
-- `better_auth.account`, so the "Google accounts" section on My profile and My
-- account could not say which address each one is.
--
-- Expand only: one new nullable column, then a fill of the rows that have
-- none. Nothing is dropped, renamed or made not-null, and no other column
-- changes, so the older preview code that reads the shared preview database
-- while this runs reads the same rows. Every account standing today is the one
-- Google account its login signed up with, so its email is the login's own
-- (`better_auth."user".email`). From then on lib/auth.ts sets it from the id
-- token Google sends, when an account is linked and on each sign-in.
--
-- The audit trigger stores a changed row whole in `logs`, the token columns
-- with it, so it is off for the fill alone and on again at once: the fill
-- copies no token anywhere. The migrator runs this in one transaction, so no
-- other write can land on the table while the trigger is off.
--
-- Safe to run again: the column is added only when missing, and the fill only
-- touches rows still without an email. lib/seed/additive-migration.test.ts
-- pins these statements.
ALTER TABLE "better_auth"."account" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
ALTER TABLE "better_auth"."account" DISABLE TRIGGER "audit_row_changes";--> statement-breakpoint
UPDATE "better_auth"."account" SET "email" = "user"."email" FROM "better_auth"."user" WHERE "user"."id" = "account"."userId" AND "account"."email" IS NULL;--> statement-breakpoint
ALTER TABLE "better_auth"."account" ENABLE TRIGGER "audit_row_changes";
