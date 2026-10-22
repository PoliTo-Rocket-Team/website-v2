-- Efesto is an engine that has not flown, so its home card and its page draw
-- its engine, drawn in outline (issue #382), not Cavour. The import gave its
-- page no panel, so the panel is set whole. Every stored version of Efesto
-- (published and draft) gets both values. Written by
-- `revisionSql(efestoEngineModel)` (lib/project-content/revision.ts,
-- import.ts); lib/project-content/content.test.ts checks this file holds
-- exactly its output.
UPDATE "project_versions" SET "content" = jsonb_set(jsonb_set("content", '{card,rocket}', '"efesto"'::jsonb, true), '{hero,visual}', '{"caption":"EFESTO · 5 KN LIQUID ENGINE","rocket":{"own":{"model":"efesto","alt":"Efesto drawn in outline, side-on: injector head on the right, then the combustion chamber and the nozzle, with a feed line along the chamber"}}}'::jsonb, true) WHERE "content"->>'slug' = 'efesto';
