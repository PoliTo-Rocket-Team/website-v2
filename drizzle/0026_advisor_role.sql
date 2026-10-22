-- The Advisor role (issue #253). Someone who hands over a role and stays in
-- the team holds an `advisor` role: on their own division (a former lead), on
-- their own department (a former head), or on neither (a former team leader).
-- An advisor leads nothing and heads nothing. This migration changes no row.
ALTER TYPE "public"."position_type" ADD VALUE 'advisor';
