CREATE TABLE "outreach_post_tags" (
	"post_id" integer NOT NULL,
	"version" "content_version" NOT NULL,
	"tag_name" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "outreach_post_tags_pk" PRIMARY KEY("post_id","version","position"),
	CONSTRAINT "outreach_post_tags_once" UNIQUE("post_id","version","tag_name")
);
--> statement-breakpoint
CREATE TABLE "outreach_post_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"version" "content_version" NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"place" text,
	"summary" text NOT NULL,
	"summary_phone" text,
	"lead" text NOT NULL,
	"body" jsonb NOT NULL,
	"photos" jsonb NOT NULL,
	"channels" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_post_versions_post_version_unique" UNIQUE("post_id","version"),
	CONSTRAINT "outreach_post_versions_titled" CHECK (char_length("outreach_post_versions"."title") >= 1),
	CONSTRAINT "outreach_post_versions_body" CHECK (jsonb_typeof("outreach_post_versions"."body") = 'array' and jsonb_array_length("outreach_post_versions"."body") >= 1),
	CONSTRAINT "outreach_post_versions_photos" CHECK (jsonb_typeof("outreach_post_versions"."photos") = 'array' and jsonb_array_length("outreach_post_versions"."photos") >= 1),
	CONSTRAINT "outreach_post_versions_channels" CHECK (jsonb_typeof("outreach_post_versions"."channels") = 'object' and ("outreach_post_versions"."channels" ? 'instagram' or "outreach_post_versions"."channels" ? 'linkedin'))
);
--> statement-breakpoint
CREATE TABLE "outreach_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_summit_versions" (
	"version" "content_version" PRIMARY KEY NOT NULL,
	"eyebrow" text NOT NULL,
	"title" text NOT NULL,
	"story" text NOT NULL,
	"story_phone" text,
	"photo_src" text NOT NULL,
	"photo_alt" text NOT NULL,
	"editions" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_summit_versions_editions" CHECK (jsonb_typeof("outreach_summit_versions"."editions") = 'array' and jsonb_array_length("outreach_summit_versions"."editions") >= 1)
);
--> statement-breakpoint
CREATE TABLE "outreach_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"award" boolean DEFAULT false NOT NULL,
	"list_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_tags_name_unique" UNIQUE("name"),
	CONSTRAINT "outreach_tags_name_length" CHECK (char_length("outreach_tags"."name") between 1 and 32)
);
--> statement-breakpoint
ALTER TABLE "outreach_post_tags" ADD CONSTRAINT "outreach_post_tags_tag_name_outreach_tags_name_fk" FOREIGN KEY ("tag_name") REFERENCES "public"."outreach_tags"("name") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "outreach_post_tags" ADD CONSTRAINT "outreach_post_tags_version_fk" FOREIGN KEY ("post_id","version") REFERENCES "public"."outreach_post_versions"("post_id","version") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_post_versions" ADD CONSTRAINT "outreach_post_versions_post_id_outreach_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."outreach_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_tags_one_award" ON "outreach_tags" USING btree ("award") WHERE "outreach_tags"."award";