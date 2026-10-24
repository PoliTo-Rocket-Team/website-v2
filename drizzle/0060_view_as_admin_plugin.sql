-- The columns Better Auth's admin plugin reads and writes (issue #604, epic
-- #597): a stored role and the ban fields on `better_auth.user`, and on
-- `better_auth.session` the account that started a View as session
-- (`impersonatedBy`, null for a plain session).
--
-- Additive only: every preview build applies this to the shared preview
-- database, which holds live sessions. Each column is new and nullable, or
-- defaulted (`banned`, false), so no existing row is rewritten, no existing
-- column changes and every session already signed in stays valid. Who may
-- start View as is not stored here: it is read from the roles at request
-- time (lib/dashboard/view-as.ts).
--
-- Safe to run twice: the shared preview database already holds these columns
-- from preview builds that applied this file as 0056, before the trunk took
-- that number, so each column is added only when it is missing.
ALTER TABLE "better_auth"."user" ADD COLUMN IF NOT EXISTS "role" text;--> statement-breakpoint
ALTER TABLE "better_auth"."user" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "better_auth"."user" ADD COLUMN IF NOT EXISTS "banReason" text;--> statement-breakpoint
ALTER TABLE "better_auth"."user" ADD COLUMN IF NOT EXISTS "banExpires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "better_auth"."session" ADD COLUMN IF NOT EXISTS "impersonatedBy" text;
