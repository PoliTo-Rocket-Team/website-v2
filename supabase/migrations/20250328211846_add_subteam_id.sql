alter table "public"."divisions" add column "subteam_id" integer;

alter table "public"."divisions" add constraint "divisions_subteam_id_fkey" FOREIGN KEY (subteam_id) REFERENCES subteams(id) not valid;

alter table "public"."divisions" validate constraint "divisions_subteam_id_fkey";


