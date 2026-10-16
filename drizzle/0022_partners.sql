CREATE TYPE "public"."content_version" AS ENUM('published', 'draft');--> statement-breakpoint
CREATE TYPE "public"."partner_logo_kind" AS ENUM('wordmark', 'mark');--> statement-breakpoint
CREATE TYPE "public"."partner_tier" AS ENUM('main', 'media');--> statement-breakpoint
CREATE TABLE "partner_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"version" "content_version" NOT NULL,
	"name" text NOT NULL,
	"tier" "partner_tier" NOT NULL,
	"logo_url" text NOT NULL,
	"logo_width" integer NOT NULL,
	"logo_height" integer NOT NULL,
	"logo_kind" "partner_logo_kind" NOT NULL,
	"logo_dark" boolean NOT NULL,
	"website" text,
	"one_liner" text NOT NULL,
	"about" text,
	"support" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_versions_partner_version_unique" UNIQUE("partner_id","version")
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_versions" ADD CONSTRAINT "partner_versions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;