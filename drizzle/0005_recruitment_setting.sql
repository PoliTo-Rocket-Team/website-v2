CREATE TABLE "recruitment_setting" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recruitment_setting_single_row" CHECK (id)
);
