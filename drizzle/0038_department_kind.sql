CREATE TYPE "public"."department_kind" AS ENUM('technical', 'operations');--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "kind" "department_kind" DEFAULT 'technical' NOT NULL;--> statement-breakpoint
-- Every department starts technical (the default above); the Operations
-- department is the one the Team page draws on its "Operations" slide
-- (boards 26 and 26m, issue #325). The team leader sets the kind of any
-- other department on Edit department.
UPDATE "departments" SET "kind" = 'operations' WHERE "name" = 'Operations' AND "closed_at" IS NULL;
