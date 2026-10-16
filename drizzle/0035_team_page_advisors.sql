CREATE TABLE "team_page_advisor_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"advisor_id" integer NOT NULL,
	"version" "content_version" NOT NULL,
	"advisor" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_page_advisor_versions_advisor_version_unique" UNIQUE("advisor_id","version")
);
--> statement-breakpoint
CREATE TABLE "team_page_advisors" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_page_advisor_versions" ADD CONSTRAINT "team_page_advisor_versions_advisor_id_team_page_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."team_page_advisors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- The audit trigger 0002 attached to every table that existed then, on the
-- two tables above (issue #286): a table created later gets none unless its
-- migration adds it, and who added, edited, published, reordered or ended an
-- advisor must be logged.
DROP TRIGGER IF EXISTS audit_row_changes ON public.team_page_advisors;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.team_page_advisors FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_row_changes ON public.team_page_advisor_versions;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.team_page_advisor_versions FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
--> statement-breakpoint
-- Today's advisors from lib/about/team.ts, carried into the store as they
-- were, each published, in the record's order and standing. Written by
-- `advisorImportSql` (lib/about/advisors-import.ts);
-- lib/about/advisors.test.ts checks this file holds exactly its output.
INSERT INTO "team_page_advisors" ("id", "site_order") VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 4),
(5, 5),
(6, 6),
(7, 7),
(8, 8),
(9, 9),
(10, 10),
(11, 11);
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('"team_page_advisors"', 'id'), (SELECT max("id") FROM "team_page_advisors"));
--> statement-breakpoint
INSERT INTO "team_page_advisor_versions" ("advisor_id", "version", "advisor") VALUES
(1, 'published', '{"name":"Prof. Alfonso Pagani","role":"Primary Faculty Advisor","standing":"principal","photo":"/team/alfonso-pagani.jpg","linkedin":"alfonsopagani","email":"alfonso.pagani@polito.it","place":1}'::jsonb),
(2, 'published', '{"name":"Prof. Enrico Zappino","role":"Faculty Advisor","standing":"principal","photo":"/team/enrico-zappino.jpg","linkedin":"enrico-zappino-4a762326","email":"enrico.zappino@polito.it","place":2}'::jsonb),
(3, 'published', '{"name":"Fabio Meloni","role":"Founder & Senior Advisor","standing":"principal","photo":"/team/fabio-meloni.jpg","linkedin":"fabioski01","email":"fabio.meloni@politorocketteam.it","place":3}'::jsonb),
(4, 'published', '{"name":"Salvatore Lagrasta","role":"Avionics","standing":"specialist","photo":"/team/salvatore-lagrasta.jpg","linkedin":"salvatore-lagrasta","email":"salvatore.lagrasta@politorocketteam.it","place":1}'::jsonb),
(5, 'published', '{"name":"Cristian Manfredi","role":"Advisor","standing":"specialist","photo":"/team/cristian-manfredi.jpg","linkedin":"cristian-manfredi","email":"cristian.manfredi@politorocketteam.it","place":2}'::jsonb),
(6, 'published', '{"name":"Luca Loiodice","role":"Additive Manufacturing","standing":"specialist","photo":"/team/luca-loiodice.jpg","linkedin":"luca-loiodice-01l10","email":"luca.loiodice@politorocketteam.it","place":3}'::jsonb),
(7, 'published', '{"name":"Francesca Bracaglia","role":"Finite Element Analysis","standing":"specialist","photo":"/team/francesca-bracaglia.jpg","email":"francesca.bracaglia@politorocketteam.it","place":4}'::jsonb),
(8, 'published', '{"name":"Flora Punzi","role":"Senior FEA Analyst & Counselor","standing":"specialist","photo":"/team/flora-punzi.jpg","linkedin":"fpunzi","place":5}'::jsonb),
(9, 'published', '{"name":"Lorenzo Pezzolato","role":"Additive Manufacturing","standing":"specialist","linkedin":"lorenzopezzolato","place":6}'::jsonb),
(10, 'published', '{"name":"Matteo Postinghel","role":"Communication & Brand Strategy","standing":"specialist","photo":"/team/matteo-postinghel.jpg","linkedin":"matteo-postinghel","email":"matteopostinghel@icloud.com","place":7}'::jsonb),
(11, 'published', '{"name":"Edoardo Walter Bignami","role":"Communication & Brand Strategy","standing":"specialist","photo":"/team/edoardo-walter-bignami.jpg","linkedin":"edoardo-bignami-68527920a","email":"edo.bigna@gmail.com","place":8}'::jsonb);
