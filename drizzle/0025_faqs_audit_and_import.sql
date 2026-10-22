-- The audit trigger 0002 attached to every table that existed then, on the
-- two tables 0024 creates (issue #258): a table created later gets none unless
-- its migration adds it, and who edited, published, reordered or removed a
-- question must be logged.
DROP TRIGGER IF EXISTS audit_row_changes ON public.faqs;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.faqs FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_row_changes ON public.faq_versions;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.faq_versions FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
--> statement-breakpoint
-- The questions of lib/apply/page.ts, carried into the store as they were,
-- each published, in their order. Written by `faqImportSql`
-- (lib/faq/import.ts); lib/faq/faq.test.ts checks this file holds exactly its
-- output.
WITH "faq" AS (INSERT INTO "faqs" ("site_order") VALUES (1) RETURNING "id")
INSERT INTO "faq_versions" ("faq_id", "version", "question", "answer")
SELECT "id", 'published', 'How can I join the Team?', ARRAY['If there are open positions, there is the possibility of joining the Team. More details can be found by reading the open positions'' descriptions and apply procedures. The main recruitment process is generally held at the beginning of the academic year, but some positions might be open in other time periods too: look out for any updates on our social media and on our website.']::text[] FROM "faq";
--> statement-breakpoint
WITH "faq" AS (INSERT INTO "faqs" ("site_order") VALUES (2) RETURNING "id")
INSERT INTO "faq_versions" ("faq_id", "version", "question", "answer")
SELECT "id", 'published', 'Are there any requirements for joining the team?', ARRAY['Candidates must have time to dedicate to our projects, and an intermediate English proficiency level is preferred. We accept all PoliTo students regardless of program and year (undergraduate, graduate and PhD).']::text[] FROM "faq";
--> statement-breakpoint
WITH "faq" AS (INSERT INTO "faqs" ("site_order") VALUES (3) RETURNING "id")
INSERT INTO "faq_versions" ("faq_id", "version", "question", "answer")
SELECT "id", 'published', 'Can I join as a first-year student?', ARRAY['Yes, and we encourage you to! Theoretical knowledge and previous experience are appreciated, but they are not everything. Young and motivated students can learn and acquire real experience while working on our projects.', 'As of Summer 2023, more than half of the Team''s members are Bachelor''s students, and many of them are first-year students!']::text[] FROM "faq";
--> statement-breakpoint
WITH "faq" AS (INSERT INTO "faqs" ("site_order") VALUES (4) RETURNING "id")
INSERT INTO "faq_versions" ("faq_id", "version", "question", "answer")
SELECT "id", 'published', 'Can I join the team as an international student?', ARRAY['Of course! As of Summer 2023, more than 25% of the Team''s members are international students. The selection process is the same for international and Italian students. As for any other student, good English knowledge is preferred. Italian language proficiency is not required, but appreciated.']::text[] FROM "faq";
--> statement-breakpoint
WITH "faq" AS (INSERT INTO "faqs" ("site_order") VALUES (5) RETURNING "id")
INSERT INTO "faq_versions" ("faq_id", "version", "question", "answer")
SELECT "id", 'published', 'Can I join the Team with a low level English proficiency?', ARRAY['The Team''s official language is English, and it is preferred that candidates have at least an intermediate language proficiency. Candidates with advanced English proficiency will have an advantage. Exceptions can be made for candidates with a particular set of skills or with important prior experience.']::text[] FROM "faq";
--> statement-breakpoint
WITH "faq" AS (INSERT INTO "faqs" ("site_order") VALUES (6) RETURNING "id")
INSERT INTO "faq_versions" ("faq_id", "version", "question", "answer")
SELECT "id", 'published', 'How much time do I need to put into the team every week?', ARRAY['There is not a rule for how much time you need to put in. There can be weeks where you will not work at all, but there will be days where you will need to work many hours. The Team is young and does not have a large number of members, so it is expected that the members of the Team put a considerable amount of work into our projects.', 'In general, we expect that students can provide at the very least 6 hours of work for the Team per week. Exceptions can be made for particular positions, such as those which require particular skills or prior experience.']::text[] FROM "faq";
--> statement-breakpoint
WITH "faq" AS (INSERT INTO "faqs" ("site_order") VALUES (7) RETURNING "id")
INSERT INTO "faq_versions" ("faq_id", "version", "question", "answer")
SELECT "id", 'published', 'Can I join the Team if I am not an engineering student?', ARRAY['Yes, the Team accepts students coming from all programs offered at Politecnico. There are many positions available in the Team, especially in the Operations subteam, which are suited also for students coming from non-engineering programs.']::text[] FROM "faq";
--> statement-breakpoint
WITH "faq" AS (INSERT INTO "faqs" ("site_order") VALUES (8) RETURNING "id")
INSERT INTO "faq_versions" ("faq_id", "version", "question", "answer")
SELECT "id", 'published', 'Do you recruit only aerospace engineering students?', ARRAY['Of course not! Even if as of now the majority of the Team''s members come from the aerospace engineering program (around 68% as of Fall 2022), some of the Team''s positions are suited for students of the computer science, electronic, mechanical, management, or energy engineering programs, as well as many others.', 'Furthermore, due to competition, the acceptance rate for aerospace engineering students is probably going to be lower than the one for students coming from other programs. This means that if you do not study aerospace engineering, you might face less competition in your application for certain positions than your aerospace engineering colleagues.']::text[] FROM "faq";
--> statement-breakpoint
WITH "faq" AS (INSERT INTO "faqs" ("site_order") VALUES (9) RETURNING "id")
INSERT INTO "faq_versions" ("faq_id", "version", "question", "answer")
SELECT "id", 'published', 'What is the acceptance rate onto the team?', ARRAY['Fall 2022 was the first general recruitment of the Team and we had an acceptance rate of around 15%. As much as we would love to accept every application, the Team can not manage the work of hundreds of members. Do not let this discourage you: we are always looking for motivated and talented young students.']::text[] FROM "faq";
--> statement-breakpoint
WITH "faq" AS (INSERT INTO "faqs" ("site_order") VALUES (10) RETURNING "id")
INSERT INTO "faq_versions" ("faq_id", "version", "question", "answer")
SELECT "id", 'published', 'Do you recruit at the beginning of the 2nd semester?', ARRAY['We do not know yet, but it is unlikely. Training new members takes time, and if students join in the winter semester they will start working towards the end of the academic year, which is not ideal.', 'Students could be recruited at the beginning of the 2nd semester if they possess a particular set of skills or experience which matches the Team''s needs.']::text[] FROM "faq";
--> statement-breakpoint
WITH "faq" AS (INSERT INTO "faqs" ("site_order") VALUES (11) RETURNING "id")
INSERT INTO "faq_versions" ("faq_id", "version", "question", "answer")
SELECT "id", 'published', 'Can I join the Team if I am not a Politecnico di Torino student, or if I am a high school student?', ARRAY['PoliTo Rocket Team is a student team which gets its resources from the Dept. of Mechanical and Aerospace engineering of Politecnico di Torino. For this reason, we can''t accept students outside Politecnico. However, it is possible to cooperate and work together on some particular projects. If you are working on a rocketry-related project and you want to collaborate with us, contact us.']::text[] FROM "faq";
