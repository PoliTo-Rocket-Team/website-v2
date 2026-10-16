-- The audit trigger 0002 attached to every table that existed then, on the
-- two tables 0019 creates (issue #256): a table created later gets none unless
-- its migration adds it, and who edited, published, reordered or removed a
-- partner must be logged.
DROP TRIGGER IF EXISTS audit_row_changes ON public.partners;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_row_changes ON public.partner_versions;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.partner_versions FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
--> statement-breakpoint
-- The partners of lib/partners.ts, carried into the store as they were, each
-- published, in their order. Written by `partnerImportSql`
-- (lib/partners-import.ts); lib/partners-import.test.ts checks this file holds
-- exactly its output.
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (1) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'Sòphia High Tech', 'main', '/design/sponsors/color-sophia.png', 514, 463, 'mark', false, 'https://www.sophiahightech.com/', 'Additive manufacturing equipment for Efesto, our liquid engine.', 'Sòphia High Tech, certified to AS/EN9100, designs and produces metal alloy aerospace components by Additive Manufacturing (SLM, to ECSS-Q-ST-70-80C) and CNC Machining.', 'Sòphia High Tech supports project Efesto with state-of-the-art equipment, crucial for the project''s success.' FROM "partner";
--> statement-breakpoint
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (2) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'Siemens', 'main', '/design/sponsors/color-siemens.png', 794, 127, 'wordmark', false, 'https://www.siemens.com/it/it.html', 'PLM software that runs the Team''s work from design to production.', 'Siemens is one of the world''s largest industrial conglomerates, in energy, aerospace and digital services. Its PLM software manages a product''s whole lifecycle, from conception through production to end of life.', 'Siemens provides a comprehensive suite of software that will be critical for the Team to take its activities forward.' FROM "partner";
--> statement-breakpoint
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (3) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'EvoMisure', 'main', '/design/sponsors/color-evomisure.png', 742, 137, 'wordmark', false, 'https://www.evomisure.it/', 'Probes and sensors for our wind tunnel tests, light enough to fly.', 'EvoMisure, founded in 2016, provides turnkey measurement solutions for aerodynamics: velocity and pressure probes and custom rakes, for wind tunnel testing and real-world applications.', 'EvoMisure supports the Team''s wind tunnel test. Their sensors are easy to use, compact and light, which makes them ideal for future flight tests too.' FROM "partner";
--> statement-breakpoint
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (4) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'Altium', 'main', '/design/sponsors/color-altium.png', 743, 163, 'wordmark', false, 'https://www.altium.com/', 'Altium Designer licences for the rocket''s onboard electronics.', 'Altium is one of the world''s leading companies in electronic design software, with advanced tools for creating PCBs and complex systems.', 'Through its Education program, Altium gives the Team Altium Designer licenses to design advanced circuits for our rocket''s onboard systems.' FROM "partner";
--> statement-breakpoint
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (5) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'ASSOCAM Scuola Camerana', 'main', '/design/sponsors/color-camerana.png', 1600, 508, 'wordmark', false, 'https://www.scuolacamerana.it/', 'Mechanical machining and parts for our builds.', 'ASSOCAM Scuola Camerana, rooted in Turin''s industry, has given post-diploma training since 1959. A training agency of Unione Industriali and Camera di Commercio of Turin, it has many labs and machines.', 'Assocam Scuola Camerana provides the Team with the mechanical machining and components it needs for its activities.' FROM "partner";
--> statement-breakpoint
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (6) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'Explorer Cases', 'main', '/design/sponsors/color-explorer.png', 310, 78, 'wordmark', false, 'https://www.explorercases.com/', 'Tough cases to carry our equipment safely to every launch.', 'Explorer Cases, made by GT Line, are indestructible, waterproof cases for professional equipment. Constant R&D has earned them multiple certifications, and strict lab tests prove them for extreme use.', 'Explorer Cases supports the Team by providing its cases for the safe and practical transport of our equipment.' FROM "partner";
--> statement-breakpoint
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (7) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'Ansys', 'main', '/design/sponsors/color-ansys.png', 207, 66, 'wordmark', false, 'https://www.ansys.com/', 'Engineering simulation software.', 'With more than 50 years of experience, Ansys is the world reference in engineering simulation, letting engineers predict how products will perform in the real world while cutting prototype costs and time.', NULL FROM "partner";
--> statement-breakpoint
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (8) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'ESSS', 'main', '/design/sponsors/color-esss.png', 768, 260, 'wordmark', false, 'https://www.esss.com/', 'Simulation software, consulting and training.', 'ESSS is a leading engineering and scientific software company. It offers finite element, fluid dynamics and multiphysics simulation, with consulting and training, for aerospace, automotive and energy.', NULL FROM "partner";
--> statement-breakpoint
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (9) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'Mul2 Research Group', 'main', '/design/sponsors/color-mul2.png', 173, 100, 'wordmark', false, 'http://www.mul2.polito.it/', '3D printers, printing materials and additive manufacturing know-how.', 'Mul2 is a research group in Politecnico di Torino''s Dept. of Mechanical and Aerospace Engineering, developing advanced structural models for MULSs, with a focus on multifield and fluid-structure analysis.', 'Mul2 provides 3D printers and 3D printing materials, along with technical support for the additive manufacturing processes.' FROM "partner";
--> statement-breakpoint
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (10) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'Magicar', 'main', '/design/sponsors/color-magicar.png', 857, 324, 'wordmark', false, NULL, 'The livery of VES, designed and crafted by hand.', 'Distinguished by outstanding professionalism and dedication, Carrozzeria Magicar of Fossano (CN) is an example of the commitment and passion of Italian and Piedmontese entrepreneurship.', 'Magicar designs and crafts the livery of our Vittorio Emanuele II (VES) project, bringing quality and character to a project of innovation and heritage.' FROM "partner";
--> statement-breakpoint
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (11) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'Astrospace', 'main', '/design/sponsors/color-astrospace.png', 1200, 193, 'wordmark', true, 'https://www.astrospace.it/', 'Outreach support and access to the ORBIT platform.', 'Astrospace is an innovative startup sharing humanity''s journey through space: news on space exploration, astronomy and the space economy, plus books, merchandise and community events.', 'Astrospace offers discounted access to the ORBIT platform, and promotes science communication, outreach and event organization through collaborative efforts.' FROM "partner";
--> statement-breakpoint
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (12) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'BETA CAE Systems', 'main', '/design/sponsors/color-beta-cae.png', 900, 408, 'wordmark', true, 'https://www.beta-cae.com/', 'ANSA and META software, with technical support.', 'BETA CAE Systems transformed CAE almost 30 years ago with automation software for simulation and analysis. Today it is a world leader in engineering simulation, in aerospace, defense, automotive, energy and more.', 'BETA CAE Systems provides material support with the ANSA and META software suites, as well as technical support to the Team.' FROM "partner";
--> statement-breakpoint
WITH "partner" AS (INSERT INTO "partners" ("site_order") VALUES (13) RETURNING "id")
INSERT INTO "partner_versions" ("partner_id", "version", "name", "tier", "logo_url", "logo_width", "logo_height", "logo_kind", "logo_dark", "website", "one_liner", "about", "support")
SELECT "id", 'published', 'JEToP', 'media', '/design/sponsors/color-jetop.png', 268, 354, 'mark', false, 'https://www.jetop.com/', 'Junior Enterprise of Politecnico di Torino.', NULL, NULL FROM "partner";