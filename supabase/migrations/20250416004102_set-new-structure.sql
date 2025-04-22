create type "public"."position_type" as enum ('president', 'head', 'lead', 'core');

revoke delete on table "public"."subteams" from "anon";

revoke insert on table "public"."subteams" from "anon";

revoke references on table "public"."subteams" from "anon";

revoke select on table "public"."subteams" from "anon";

revoke trigger on table "public"."subteams" from "anon";

revoke truncate on table "public"."subteams" from "anon";

revoke update on table "public"."subteams" from "anon";

revoke delete on table "public"."subteams" from "authenticated";

revoke insert on table "public"."subteams" from "authenticated";

revoke references on table "public"."subteams" from "authenticated";

revoke select on table "public"."subteams" from "authenticated";

revoke trigger on table "public"."subteams" from "authenticated";

revoke truncate on table "public"."subteams" from "authenticated";

revoke update on table "public"."subteams" from "authenticated";

revoke delete on table "public"."subteams" from "service_role";

revoke insert on table "public"."subteams" from "service_role";

revoke references on table "public"."subteams" from "service_role";

revoke select on table "public"."subteams" from "service_role";

revoke trigger on table "public"."subteams" from "service_role";

revoke truncate on table "public"."subteams" from "service_role";

revoke update on table "public"."subteams" from "service_role";


alter table "public"."divisions" drop constraint "divisions_subteam_id_fkey";

alter table "public"."roles" drop constraint "positions_subteam_id_fkey";

alter table "public"."subteams" drop constraint "subteams_pkey";

drop index if exists "public"."subteams_pkey";

drop table "public"."subteams";

create table "public"."departments" (
    "id" integer not null,
    "name" text,
    "started_at" date,
    "closed_at" date,
    "code" text
);


alter table "public"."departments" enable row level security;

alter table "public"."divisions" drop column "subteam_id";

alter table "public"."divisions" add column "dept_id" integer;


alter table "public"."members" drop column "has_pp";

alter table "public"."members" add column "nda_confirmed_by" integer;

alter table "public"."members" add column "picture" text;


alter table "public"."roles" drop column "subteam_id";

alter table "public"."roles" add column "dept_id" integer;



alter table "public"."roles" alter column "type" drop default;
alter table "public"."roles" alter column "type" drop not null;
alter table "public"."roles" alter column "type" set data type text;
drop type "public"."position type";

alter table "public"."roles" alter column "type" set data type position_type using "type"::text::position_type;
alter table "public"."roles" alter column "type" set default 'core'::position_type;




CREATE UNIQUE INDEX subteams_pkey ON public.departments USING btree (id);

alter table "public"."departments" add constraint "subteams_pkey" PRIMARY KEY using index "subteams_pkey";

alter table "public"."members" add constraint "members_nda_confirmed_by_fkey" FOREIGN KEY (nda_confirmed_by) REFERENCES members(member_id) not valid;

alter table "public"."members" validate constraint "members_nda_confirmed_by_fkey";

alter table "public"."divisions" add constraint "divisions_subteam_id_fkey" FOREIGN KEY (dept_id) REFERENCES departments(id) not valid;

alter table "public"."divisions" validate constraint "divisions_subteam_id_fkey";

alter table "public"."roles" add constraint "positions_subteam_id_fkey" FOREIGN KEY (dept_id) REFERENCES departments(id) not valid;

alter table "public"."roles" validate constraint "positions_subteam_id_fkey";



grant delete on table "public"."departments" to "anon";

grant insert on table "public"."departments" to "anon";

grant references on table "public"."departments" to "anon";

grant select on table "public"."departments" to "anon";

grant trigger on table "public"."departments" to "anon";

grant truncate on table "public"."departments" to "anon";

grant update on table "public"."departments" to "anon";

grant delete on table "public"."departments" to "authenticated";

grant insert on table "public"."departments" to "authenticated";

grant references on table "public"."departments" to "authenticated";

grant select on table "public"."departments" to "authenticated";

grant trigger on table "public"."departments" to "authenticated";

grant truncate on table "public"."departments" to "authenticated";

grant update on table "public"."departments" to "authenticated";

grant delete on table "public"."departments" to "service_role";

grant insert on table "public"."departments" to "service_role";

grant references on table "public"."departments" to "service_role";

grant select on table "public"."departments" to "service_role";

grant trigger on table "public"."departments" to "service_role";

grant truncate on table "public"."departments" to "service_role";

grant update on table "public"."departments" to "service_role";


