-- The Access page gives a Content grant (Owner decision, 2026-10-21, issue
-- #504): edit-only, across the whole team, opening the Projects, Outreach,
-- Partners, FAQ and Team page editors and nothing else. It is a `scopes` row
-- with scope `website` and this new target `content`, so it reads apart from
-- the Alumni grant, the `website` row on `all`, which keeps its meaning and
-- needs no rewrite. No row is added or changed here: nobody holds Content
-- until someone gives it on the Access page.
ALTER TYPE "public"."target_type" ADD VALUE 'content';
