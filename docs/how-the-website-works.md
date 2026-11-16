# How the website works

A short tour of the PoliTo Rocket Team website for new team members who will work on it. It
explains the parts and how they fit together. For setup steps see the [README](../README.md); for
the dashboard's exact rules see [dashboard-rules.md](dashboard-rules.md); for why things are the
way they are see the decision records in [`.decisions/`](../.decisions).

## Two halves: the public site and the dashboard

**The public site** is what visitors see: the home page, Projects (Cavour, VES, Efesto), the Team
page and Alumni, Outreach (news posts), Partners, Apply, and the legal pages. Visitors never sign in
to read it.

**The dashboard** (`/dashboard`) is where team members sign in and run the team: the team tree and
member details, alumni, recruitment (positions and applications), the content behind the public
pages (outreach posts, projects, partners, FAQ, Team page layout), orders, access grants and the
activity log. Everyone uses the same pages; what changes by role is which data they see and which
actions they may take.

Most public pages read the same records the dashboard edits. Editing a post or a member in the
dashboard changes the public page; nothing is copied by hand.

## The stack

- **Next.js** (App Router) renders both halves. Pages live in [`app/`](../app), shared UI in
  [`components/`](../components), and the domain logic in [`lib/`](../lib).
- **Neon Postgres** holds the data, through **Drizzle ORM**. The schema is in [`db/`](../db) and
  each change to it is a migration in [`drizzle/`](../drizzle).
- **Better Auth** handles sign-in. Sign-in is with Google only; there are no passwords.
- **Vercel Blob** stores uploaded files: a private store for application files and order documents,
  and a public store for photos shown on the site (profile photos, post photos, logos, project
  images).
- **Tailwind CSS** styles everything. The 3D rockets on the home and project pages are drawn with
  three.js (React Three Fiber).
- **Vercel** hosts it.

## Where the data lives

One Neon project has three database branches:

| Branch | Used by | Notes |
|---|---|---|
| `main` | the live site | Real member data. Only the owner changes it by hand. |
| `preview` | every preview deployment | Shared by all previews, filled with seeded dummy data. |
| `development` | local work pulled from Vercel | Local seeding runs on a local Postgres instead. |

Previews also have their own public photo store, so test uploads never mix with the live site's
photos.

## How a change reaches the live site

1. Work happens on a branch off **`dev`** and becomes a pull request into `dev`.
2. Every pull request gets a **Vercel preview** (its own URL) and runs CI: type check, tests and a
   secrets scan. On previews, a tester sign-in lets reviewers act as seeded people.
3. A pull request merges through GitHub's **merge queue**, which runs the checks once more.
4. A **release** is one pull request from `dev` into **`main`**. Merging it deploys production.
5. Every build **applies pending database migrations first**, then deploys. Migrations are
   additive (they add, never remove what live code still reads), so an older deployment keeps
   working while a newer one builds.

## Things that run on their own

Three daily jobs run on production ([`vercel.json`](../vercel.json), routes in
[`app/api/cron/`](../app/api/cron)):

- **Anonymize deleted accounts**: accounts deleted a while ago lose their personal data.
- **Delete withdrawn files**: files of withdrawn applications are removed from the private store.
- **Delete unused uploads**: photos uploaded in an editor but never saved are removed from the
  public store.

## Where to look next

- [README](../README.md): setup, environment variables, seeding.
- [AGENTS.md](../AGENTS.md): how work is planned, built, reviewed and shipped in this repo.
- [docs/dashboard-rules.md](dashboard-rules.md): who sees what and who may do what in the dashboard.
- [`.decisions/`](../.decisions): one file per architecture decision.
- [`.glossary/`](../.glossary): the words the code and the team use.
