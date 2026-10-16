CREATE TABLE "faq_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"faq_id" integer NOT NULL,
	"version" "content_version" NOT NULL,
	"question" text NOT NULL,
	"answer" text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faq_versions_faq_version_unique" UNIQUE("faq_id","version"),
	CONSTRAINT "faq_versions_question_length" CHECK (char_length("faq_versions"."question") between 1 and 120),
	CONSTRAINT "faq_versions_answered" CHECK (cardinality("faq_versions"."answer") >= 1)
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "faq_versions" ADD CONSTRAINT "faq_versions_faq_id_faqs_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;