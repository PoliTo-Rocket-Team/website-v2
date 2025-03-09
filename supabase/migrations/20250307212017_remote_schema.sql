

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."application_status" AS ENUM (
    'pending',
    'rejected',
    'accepted',
    'received',
    'accepted_by_another_team'
);


ALTER TYPE "public"."application_status" OWNER TO "postgres";


CREATE TYPE "public"."position type" AS ENUM (
    'chief',
    'lead',
    'coordinator',
    'core_member'
);


ALTER TYPE "public"."position type" OWNER TO "postgres";


CREATE TYPE "public"."status" AS ENUM (
    'pending',
    'accepted',
    'rejected'
);


ALTER TYPE "public"."status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_president_id"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$DECLARE
  president_member_id bigint;
BEGIN
  SELECT member_id INTO president_member_id
  FROM positions
  WHERE title = 'President'
  AND leaved_at IS NULL; 

  IF NOT FOUND THEN
    RAISE NOTICE 'No current position with title "President" found.';
    RETURN NULL;
  END IF;

  RETURN president_member_id;
END;$$;


ALTER FUNCTION "public"."get_president_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_auth_users"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE 
  existing_user UUID;
BEGIN
  -- Check if the user's email already exists in the users table
  SELECT id INTO existing_user FROM users WHERE email = NEW.email;

  -- If the user already exists and their id is different, update their ID with the new UUID from auth.users
  IF existing_user IS NOT NULL AND existing_user <> NEW.id THEN
    UPDATE users SET id = NEW.id WHERE email = NEW.email;
  ELSIF existing_user IS NULL THEN
    -- Insert new user into users table with id from auth.users and email
    INSERT INTO users (id, email, created_at)
    VALUES (NEW.id, NEW.email, NOW());
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_auth_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_member_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update the user_id in members table when there's a match
  UPDATE public.members
  SET user_id = NEW.id
  WHERE personal_email = NEW.email;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_member_user_id"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" integer NOT NULL,
    "open_position_id" integer,
    "ml_name" "text",
    "cv_name" "text",
    "applied_at" timestamp with time zone NOT NULL,
    "status" "public"."application_status" DEFAULT 'received'::"public"."application_status" NOT NULL,
    "custom_answers" "jsonb"[],
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."apply_positions" (
    "id" integer NOT NULL,
    "status" boolean NOT NULL,
    "division_id" integer,
    "title" "text",
    "description" "text",
    "desirable_skills" "text"[],
    "required_skills" "text"[],
    "custom_questions" "text"[],
    "created_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."apply_positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."divisions" (
    "id" integer NOT NULL,
    "name" "text",
    "started_at" "date",
    "closed_at" "date",
    "code" "text"
);


ALTER TABLE "public"."divisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."members" (
    "member_id" integer NOT NULL,
    "has_pp" boolean NOT NULL,
    "prt_email" "text",
    "mobile_number" "text",
    "discord" "text",
    "nda_name" "text",
    "nda_signed_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" integer NOT NULL,
    "requester" integer,
    "description" "text",
    "reason" "text",
    "quantity" integer,
    "price" integer,
    "name" "text",
    "created_at" timestamp with time zone NOT NULL,
    "quote_name" "text",
    "status" "public"."status" DEFAULT 'pending'::"public"."status" NOT NULL
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" integer NOT NULL,
    "member_id" integer,
    "subteam_id" integer,
    "division_id" integer,
    "title" "text",
    "started_at" "date",
    "leaved_at" "date",
    "type" "public"."position type" DEFAULT 'core_member'::"public"."position type" NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subteams" (
    "id" integer NOT NULL,
    "name" "text",
    "started_at" "date",
    "closed_at" "date",
    "code" "text"
);


ALTER TABLE "public"."subteams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "email" "text",
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone,
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "origin" "text",
    "level_of_study" "text",
    "linkedin" "text",
    "polito_id" "text",
    "program" "text",
    "member" integer
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."divisions"
    ADD CONSTRAINT "divisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("member_id");



ALTER TABLE ONLY "public"."apply_positions"
    ADD CONSTRAINT "open_positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subteams"
    ADD CONSTRAINT "subteams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id1_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_open_position_id_fkey" FOREIGN KEY ("open_position_id") REFERENCES "public"."apply_positions"("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."apply_positions"
    ADD CONSTRAINT "open_positions_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_requester_fkey" FOREIGN KEY ("requester") REFERENCES "public"."members"("member_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "positions_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "positions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("member_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "positions_subteam_id_fkey" FOREIGN KEY ("subteam_id") REFERENCES "public"."subteams"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_member_fkey" FOREIGN KEY ("member") REFERENCES "public"."members"("member_id") ON UPDATE CASCADE ON DELETE SET NULL;



CREATE POLICY "Users can insert" ON "public"."applications" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can select" ON "public"."applications" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update" ON "public"."applications" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (true);



CREATE POLICY "Users can update" ON "public"."users" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."apply_positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."divisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subteams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."get_president_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_president_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_president_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_auth_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_auth_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_auth_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_member_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_member_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_member_user_id"() TO "service_role";


















GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."apply_positions" TO "anon";
GRANT ALL ON TABLE "public"."apply_positions" TO "authenticated";
GRANT ALL ON TABLE "public"."apply_positions" TO "service_role";



GRANT ALL ON TABLE "public"."divisions" TO "anon";
GRANT ALL ON TABLE "public"."divisions" TO "authenticated";
GRANT ALL ON TABLE "public"."divisions" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."subteams" TO "anon";
GRANT ALL ON TABLE "public"."subteams" TO "authenticated";
GRANT ALL ON TABLE "public"."subteams" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
