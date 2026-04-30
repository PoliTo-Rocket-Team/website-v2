CREATE TYPE "public"."access_level_type" AS ENUM('view', 'edit');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('pending', 'rejected', 'accepted', 'received', 'accepted_by_another_team');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."position_type" AS ENUM('president', 'head', 'lead', 'core');--> statement-breakpoint
CREATE TYPE "public"."scope_type" AS ENUM('admin', 'org', 'department', 'division', 'website');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('all', 'positions', 'applications', 'members', 'orders', 'faq', 'blog', 'logs');--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "better_auth";--> statement-breakpoint
CREATE TABLE "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"apply_position_id" integer,
	"user_id" text,
	"ml_name" text,
	"cv_name" text,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "application_status" DEFAULT 'received' NOT NULL,
	"custom_answers" jsonb[]
);
--> statement-breakpoint
CREATE TABLE "apply_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" boolean NOT NULL,
	"division_id" integer,
	"title" text,
	"description" text,
	"required_skills" text[],
	"desirable_skills" text[],
	"custom_questions" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"requires_motivation_letter" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"started_at" date DEFAULT now() NOT NULL,
	"closed_at" date,
	"code" text
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"dept_id" integer,
	"name" text NOT NULL,
	"started_at" date DEFAULT now() NOT NULL,
	"closed_at" date,
	"code" text
);
--> statement-breakpoint
CREATE TABLE "members" (
	"member_id" serial PRIMARY KEY NOT NULL,
	"prt_email" text,
	"mobile_number" text,
	"discord" text,
	"nda_signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nda_name" text,
	"nda_confirmed_by" integer,
	"picture" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" "status" DEFAULT 'pending' NOT NULL,
	"requester" integer,
	"description" text,
	"reason" text,
	"quantity" integer,
	"price" numeric,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quote_name" text
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer,
	"dept_id" integer,
	"division_id" integer,
	"title" text NOT NULL,
	"started_at" date DEFAULT now() NOT NULL,
	"leaved_at" date,
	"type" "position_type"
);
--> statement-breakpoint
CREATE TABLE "scopes" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer,
	"given_by" integer,
	"scope" "scope_type" NOT NULL,
	"target" "target_type" NOT NULL,
	"access_level" "access_level_type" DEFAULT 'view' NOT NULL,
	"dept_id" integer,
	"division_id" integer,
	CONSTRAINT "unique_scope_combination" UNIQUE("member_id","scope","target","dept_id","division_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"origin" text,
	"level_of_study" text,
	"linkedin" text,
	"polito_id" text,
	"program" text,
	"member" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"access" text[] DEFAULT '{}'::text[]
);
--> statement-breakpoint
CREATE TABLE "better_auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "better_auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "better_auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "better_auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_apply_position_id_apply_positions_id_fk" FOREIGN KEY ("apply_position_id") REFERENCES "public"."apply_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply_positions" ADD CONSTRAINT "apply_positions_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_requester_members_member_id_fk" FOREIGN KEY ("requester") REFERENCES "public"."members"("member_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_nda_confirmed_by_members_member_id_fk" FOREIGN KEY ("nda_confirmed_by") REFERENCES "public"."members"("member_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_member_id_members_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("member_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_member_id_members_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("member_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_given_by_members_member_id_fk" FOREIGN KEY ("given_by") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_dept_id_departments_id_fk" FOREIGN KEY ("dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_structure_constraints" CHECK (
  ("scope" = 'admin' AND "dept_id" IS NULL AND "division_id" IS NULL) OR
  ("scope" = 'org' AND "dept_id" IS NULL AND "division_id" IS NULL) OR
  ("scope" = 'department' AND "dept_id" IS NOT NULL AND "division_id" IS NULL) OR
  ("scope" = 'division' AND "division_id" IS NOT NULL AND "dept_id" IS NULL) OR
  ("scope" = 'website' AND "dept_id" IS NULL AND "division_id" IS NULL)
);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_member_members_member_id_fk" FOREIGN KEY ("member") REFERENCES "public"."members"("member_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "better_auth"."account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "better_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "better_auth"."session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "better_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "better_auth"."account" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_key" ON "better_auth"."session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "better_auth"."session" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_key" ON "better_auth"."user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "better_auth"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE OR REPLACE FUNCTION better_auth.uid()
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::text
$function$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.sync_auth_users()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  existing_user TEXT;
BEGIN
  SELECT id INTO existing_user FROM public.users WHERE email = NEW.email;

  IF existing_user IS NOT NULL AND existing_user <> NEW.id THEN
    UPDATE public.users SET id = NEW.id WHERE email = NEW.email;
  ELSIF existing_user IS NULL THEN
    INSERT INTO public.users (id, email, created_at)
    VALUES (NEW.id, NEW.email, NOW());
  END IF;

  RETURN NEW;
END;
$$ SECURITY DEFINER;--> statement-breakpoint
CREATE TRIGGER on_better_auth_user_created
AFTER INSERT ON better_auth.user
FOR EACH ROW EXECUTE FUNCTION public.sync_auth_users();
