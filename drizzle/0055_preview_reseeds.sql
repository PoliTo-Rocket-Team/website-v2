-- The re-seed requests the shared `preview` branch has served (issue #595,
-- ADR 0016 amendment of 2026-10-24). A preview build re-seeds the branch only
-- for a `PREVIEW_RESEED_REQUEST` value this table does not hold yet, and
-- records the value in the same transaction, so one request runs once and
-- later builds leave the rows in place. The re-seed keeps this table.
--
-- Additive only: one new table. Nothing is dropped, renamed or rewritten, and
-- no row is added or changed. It has no audit trigger: its one row per
-- request is the build's own record, not something a person changed.
CREATE TABLE "preview_reseeds" (
	"request" text PRIMARY KEY NOT NULL,
	"reseeded_at" timestamp with time zone DEFAULT now() NOT NULL
);
