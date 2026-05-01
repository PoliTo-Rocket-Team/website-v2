CREATE TABLE IF NOT EXISTS "application_files" (
  "id" serial PRIMARY KEY NOT NULL,
  "r2_key" text NOT NULL,
  "original_filename" text NOT NULL,
  "mime_type" text,
  "file_size" bigint,
  "file_hash" text,
  "uploaded_at" timestamp with time zone DEFAULT now(),
  "user_id" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_files" ADD CONSTRAINT "application_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "application_files" ADD CONSTRAINT "application_files_r2_key_unique" UNIQUE("r2_key");
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "cv_file_id" integer;
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "cover_letter_file_id" integer;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "applications" ADD CONSTRAINT "applications_cv_file_id_application_files_id_fk" FOREIGN KEY ("cv_file_id") REFERENCES "public"."application_files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "applications" ADD CONSTRAINT "applications_cover_letter_file_id_application_files_id_fk" FOREIGN KEY ("cover_letter_file_id") REFERENCES "public"."application_files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_files_r2_key_idx" ON "application_files" USING btree ("r2_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_files_file_hash_idx" ON "application_files" USING btree ("file_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_cv_file_id_idx" ON "applications" USING btree ("cv_file_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_cover_letter_file_id_idx" ON "applications" USING btree ("cover_letter_file_id");
