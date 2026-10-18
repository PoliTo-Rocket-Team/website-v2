-- VES draws its own rocket, Mark I, on its home card and its page (issue
-- #361), not Cavour's, and its page caption names that mark. Every stored
-- version of VES (published and draft) gets the three values. Written by
-- `revisionSql(vesMarkOneRocket)` (lib/project-content/revision.ts,
-- import.ts); lib/project-content/content.test.ts checks this file holds
-- exactly its output.
UPDATE "project_versions" SET "content" = jsonb_set(jsonb_set(jsonb_set("content", '{card,rocket}', '"ves"'::jsonb, true), '{hero,visual,caption}', '"VES MARK I · EUROC 2024 CONFIGURATION"'::jsonb, true), '{hero,visual,rocket}', '{"own":{"model":"ves","alt":"VES Mark I in its EuRoC 2024 livery, side-on, nose right"}}'::jsonb, true) WHERE "content"->>'slug' = 'ves';
