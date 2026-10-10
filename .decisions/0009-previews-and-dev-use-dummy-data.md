---
id: 0009
title: "Previews and next dev without a database run on dummy data with a test developer sign-in, never production"
status: accepted
date: 2026-10-10
tags: [previews, dummy-data, test-developer, dashboard]
---

# 0009 — Previews and next dev without a database run on dummy data with a test developer sign-in, never production

**What this decides:** Vercel previews have no database. They, and `next dev` on a machine with no `DATABASE_URL`, show the site and the dashboard from dummy data. A reviewer signs in as "test developer" and switches which kind of viewer they look as. Production never does any of this.

## Context

Decided 2026-10-10 by the project owner. Approval: https://github.com/PoliTo-Rocket-Team/website-v2/issues/181#issuecomment-6095711336. The rule texts are in the original report of issue #181. The work was built in issues #129 (local seeded testers), #141 (the dashboard data interface) and #150 (dummy mode on previews).

Which viewer kind reaches which dashboard page is in the dashboard rules doc, [docs/dashboard-rules.md](../docs/dashboard-rules.md) (issue #180), and is not copied here. How the code is shaped is in [.patterns/dashboard-data-interface.md](../.patterns/dashboard-data-interface.md).

## Decision

**Previews, and `next dev` without `DATABASE_URL`, run on dummy data with a "Sign in as test developer" and a viewer switch; production never does.**

1. **No database on previews.** A Vercel preview reads dummy data, never a database.
2. **`next dev` without `DATABASE_URL` reads dummy data too.**
3. **"Sign in as test developer"** signs a reviewer in with no Google account. A viewer switch then sets which kind of viewer they look as.
4. **Seeded testers are local only.** The seeded tester accounts of issue #129 exist only under `next dev`.
5. **Never in production.** Production never shows dummy data, never offers the test developer sign-in, and never accepts its cookie.

**Binding constraints.**
- Never connect a preview to a database to "make it real".
- Every gate that turns dummy data or the test developer on must be false in production.
- A test developer's changes never reach a database.

## Consequences

- Anyone can review a preview without an account or data access.
- Every dashboard page needs a dummy side as well as a database side.

## Gaps

None found for these rules. `dummyDataOn` in [lib/dummy-data/mode.ts](../lib/dummy-data/mode.ts) is true only on a Vercel preview or under `next dev` with no `DATABASE_URL`. `testDeveloperOn` in [lib/test-developer.ts](../lib/test-developer.ts) is true only on a preview or under `next dev`. `testerSignInOn` in [lib/dev-tester.ts](../lib/dev-tester.ts) is true only under `next dev` off Vercel. The viewer switch is the "View as" menu in [components/dashboard/user-card.tsx](../components/dashboard/user-card.tsx). The viewer kinds it offers are four, not the five the glossary ruling names; that gap is under `viewer` in [.glossary/TERMS.md](../.glossary/TERMS.md).

## Records

Terms: test developer, viewer. Rows in [.glossary/TERMS.md](../.glossary/TERMS.md).
