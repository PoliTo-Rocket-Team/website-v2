CREATE TYPE "public"."hand_over_decision" AS ENUM('confirmed', 'declined');--> statement-breakpoint
CREATE TYPE "public"."hand_over_outcome" AS ENUM('advisor', 'leave');--> statement-breakpoint
CREATE TYPE "public"."hand_over_role" AS ENUM('lead', 'head');--> statement-breakpoint
CREATE TABLE "hand_over_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_id" integer NOT NULL,
	"role" "hand_over_role" NOT NULL,
	"division_id" integer,
	"dept_id" integer,
	"to_id" integer NOT NULL,
	"outcome" "hand_over_outcome" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decision" "hand_over_decision",
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	CONSTRAINT "hand_over_requests_unit" CHECK (("hand_over_requests"."role" = 'lead' and "hand_over_requests"."division_id" is not null and "hand_over_requests"."dept_id" is null) or ("hand_over_requests"."role" = 'head' and "hand_over_requests"."dept_id" is not null and "hand_over_requests"."division_id" is null)),
	CONSTRAINT "hand_over_requests_someone_else" CHECK ("hand_over_requests"."from_id" <> "hand_over_requests"."to_id"),
	CONSTRAINT "hand_over_requests_decided" CHECK (("hand_over_requests"."decision" is null) = ("hand_over_requests"."decided_at" is null))
);
--> statement-breakpoint
ALTER TABLE "hand_over_requests" ADD CONSTRAINT "hand_over_requests_from_id_members_member_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."members"("member_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hand_over_requests" ADD CONSTRAINT "hand_over_requests_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hand_over_requests" ADD CONSTRAINT "hand_over_requests_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hand_over_requests" ADD CONSTRAINT "hand_over_requests_to_id_members_member_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."members"("member_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hand_over_requests" ADD CONSTRAINT "hand_over_requests_decided_by_members_member_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hand_over_requests_one_waiting" ON "hand_over_requests" USING btree ("from_id") WHERE "hand_over_requests"."decision" is null;