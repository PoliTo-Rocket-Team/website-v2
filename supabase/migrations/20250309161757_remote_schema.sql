alter table "public"."roles" alter column "type" drop default;

alter type "public"."position type" rename to "position type__old_version_to_be_dropped";

create type "public"."position type" as enum ('chief', 'lead', 'coordinator', 'core_member', 'president');

alter table "public"."roles" alter column type type "public"."position type" using type::text::"public"."position type";

alter table "public"."roles" alter column "type" set default 'core_member'::"position type";

drop type "public"."position type__old_version_to_be_dropped";

alter table "public"."applications" alter column "applied_at" set default (now() AT TIME ZONE 'utc'::text);

alter table "public"."applications" alter column "applied_at" set not null;

alter table "public"."applications" alter column "applied_at" set data type timestamp with time zone using "applied_at"::timestamp with time zone;

alter table "public"."apply_positions" alter column "created_at" set default (now() AT TIME ZONE 'utc'::text);

alter table "public"."members" alter column "nda_signed_at" set default (now() AT TIME ZONE 'utc'::text);

alter table "public"."orders" alter column "created_at" set default (now() AT TIME ZONE 'utc'::text);

alter table "public"."orders" alter column "created_at" set data type timestamp with time zone using "created_at"::timestamp with time zone;

alter table "public"."users" alter column "created_at" set default (now() AT TIME ZONE 'utc'::text);


