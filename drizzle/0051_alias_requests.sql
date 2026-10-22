-- Team email alias requests (epic #538, issue #541). A division lead, a
-- department head or the team leader asks for an alias for a member they may
-- manage; the team leader, the operations lead or the IT lead creates it by
-- hand in Google Workspace and marks the request created with the address,
-- or declines it. The address is saved on the member's record, beside their
-- team email. lib/dashboard/alias-request.ts owns who may do what.
--
-- Additive only: one new type, one new table with its index, its audit
-- trigger, and two nullable columns on `members`. Nothing is dropped, renamed
-- or rewritten, and no row is added or changed. It is 0051 because epic
-- #522's 0050 is not on the trunk yet.
--
-- `requested_by` is null for a request the site makes by itself when someone
-- becomes a lead, a head or the team leader (issue #543). A request stays
-- open until it is created, declined or cancelled, and a member has at most
-- one open request (`alias_requests_one_open`), as `hand_over_requests_one_waiting`
-- keeps one waiting hand-over per person. `email_alias_set_up_at` is when the
-- member said they set the alias up (issue #542); nothing writes it yet.
CREATE TYPE "public"."alias_request_outcome" AS ENUM('created', 'declined', 'cancelled');--> statement-breakpoint
CREATE TABLE "alias_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"requested_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" "alias_request_outcome",
	"answered_by" integer,
	"answered_at" timestamp with time zone,
	CONSTRAINT "alias_requests_answered" CHECK (("alias_requests"."outcome" is null) = ("alias_requests"."answered_at" is null))
);
--> statement-breakpoint
ALTER TABLE "alias_requests" ADD CONSTRAINT "alias_requests_member_id_members_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("member_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alias_requests" ADD CONSTRAINT "alias_requests_requested_by_members_member_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alias_requests" ADD CONSTRAINT "alias_requests_answered_by_members_member_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alias_requests_one_open" ON "alias_requests" USING btree ("member_id") WHERE "alias_requests"."outcome" is null;--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_row_changes ON public.alias_requests;--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.alias_requests FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "email_alias" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "email_alias_set_up_at" timestamp with time zone;
