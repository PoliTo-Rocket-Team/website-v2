-- Full access from the role (issue #238). The operations lead's and the IT
-- lead's seats are marked by a flag on the seat's role row, set once in the
-- data, never matched by a unit's code or a title (Owner decision,
-- 2026-10-11). The team leader is the `president` role type and needs no
-- flag. This migration marks no row: the two seats are set by hand on the
-- data, as db/seed.sql does for the sample team.
CREATE TYPE "public"."full_access_seat" AS ENUM('operations_lead', 'it_lead');--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "full_access" "full_access_seat";
