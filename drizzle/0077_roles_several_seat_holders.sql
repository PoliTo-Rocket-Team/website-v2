-- Every seat may have several active holders (epic #861,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/861; issue #867,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/867). Owner decision
-- on the epic, 2026-10-30: the team leader seat, each full-access seat and each
-- department's head seat may each have several active holders, and every
-- holder gets the seat's full rights.
--
-- This drops the three unique partial indexes migration 0062 created (issue
-- #667) and nothing else: no row is deleted, updated or rewritten, and no
-- column or type changes. Every preview build applies this to the shared
-- preview database while older preview code still reads it; that code only
-- ever wrote one active holder per seat, so it reads the same rows either way.
-- `IF EXISTS` lets it run again, and run on a database that never held them.
-- These three statements are the only ones here, and
-- lib/seed/additive-migration.test.ts pins them.
DROP INDEX IF EXISTS "roles_one_active_team_leader";--> statement-breakpoint
DROP INDEX IF EXISTS "roles_one_active_full_access_seat";--> statement-breakpoint
DROP INDEX IF EXISTS "roles_one_active_department_head";
