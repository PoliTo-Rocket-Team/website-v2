-- VES draws its own rocket, Mark I, on its home card and its page (issue
-- #361), not Cavour's; its page caption names that mark, and the key facts
-- under the caption are Mark I's. Every stored version of VES (published and
-- draft) gets the four values. Written by `revisionSql(vesMarkOneRocket)`
-- (lib/project-content/revision.ts, import.ts);
-- lib/project-content/content.test.ts checks this file holds exactly its
-- output.
UPDATE "project_versions" SET "content" = jsonb_set(jsonb_set(jsonb_set(jsonb_set("content", '{card,rocket}', '"ves"'::jsonb, true), '{hero,visual,caption}', '"VES MARK I · EUROC 2024 CONFIGURATION"'::jsonb, true), '{hero,visual,rocket}', '{"own":{"model":"ves","alt":"VES Mark I in its EuRoC 2024 livery, side-on, nose right"}}'::jsonb, true), '{hero,facts}', '[{"value":"134 mm","label":{"text":"DIAMETER"}},{"value":"3 420 mm","label":{"text":"LENGTH"}},{"value":"25.8 kg","label":{"text":"WET MASS"}},{"value":"CTI M1790","label":{"text":"MOTOR"}},{"value":"259 m/s","label":{"text":"MAX SPEED"}},{"value":"3 000 m","label":{"text":"TARGET APOGEE"}}]'::jsonb, true) WHERE "content"->>'slug' = 'ves';
