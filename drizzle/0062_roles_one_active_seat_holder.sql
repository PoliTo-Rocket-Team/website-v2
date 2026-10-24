-- One active holder per seat, kept by the database itself (issue #667,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/667). The rules
-- allow one active team leader (`type = 'president'`), one active holder of
-- each full-access seat (`full_access`) and one active head per department
-- (`type = 'head'`, by `dept_id`). Each index below counts only active role
-- rows (`leaved_at IS NULL`), so an ended row beside an active one is still
-- allowed, and refuses a second active row for the same seat.
--
-- Additive only: every preview build applies this to the shared preview
-- database. It only creates indexes: it drops, deletes and updates nothing,
-- and it changes no column or type. A database that already holds two active
-- holders of one seat refuses the index; such rows are reported, never
-- changed by a migration.
CREATE UNIQUE INDEX IF NOT EXISTS "roles_one_active_team_leader" ON "roles" USING btree ("type") WHERE "roles"."leaved_at" is null and "roles"."type" = 'president';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_one_active_full_access_seat" ON "roles" USING btree ("full_access") WHERE "roles"."leaved_at" is null and "roles"."full_access" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_one_active_department_head" ON "roles" USING btree ("dept_id") WHERE "roles"."leaved_at" is null and "roles"."type" = 'head' and "roles"."dept_id" is not null;
