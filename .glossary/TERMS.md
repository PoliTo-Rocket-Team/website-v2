# PoliTo Rocket Team website domain vocabulary (TERMS)

The repo-owned vocabulary spine. One row per term: the canonical definition, and where a name has
drifted, what the term is **not**. When the code and this file disagree, the code is authoritative
and this file is the doc to fix.

## Team structure

| Term | Definition | Not |
|---|---|---|
| active member | A member who has not left: no leave date. "The Team" page lists active members ([design/project-notes.md](../design/project-notes.md), [design/HANDOFF.md](../design/HANDOFF.md)). The docs put joined/left dates on the member; in the schema the dates live on each role (`roles.started_at`, `roles.leaved_at`), not on `members`. | |
| alumni | Former members, grouped by academic year computed from their date ranges, with no yearly upkeep ([design/project-notes.md](../design/project-notes.md)). A planned public page; no code computes it yet. | |
| department | The top unit of the team: `departments` table, with `name`, `code`, `started_at` and `closed_at` ([db/schema/public.ts](../db/schema/public.ts)). A department with `closed_at` set is closed, and dashboard queries skip it. Code abbreviates it `dept` (`dept_id`, `dept_name`). | |
| division | A unit inside one department: `divisions` table, linked by `dept_id`, with its own `code` and `closed_at` ([db/schema/public.ts](../db/schema/public.ts)). Apply positions, roles and scopes can point at a division. Code abbreviates it `div` (`div_id`, `div_name`). | |
| member | A person on the team: `members` table, keyed by `member_id`, holding team contact data (PRT email, mobile, Discord), NDA fields and a picture ([db/schema/public.ts](../db/schema/public.ts)). A user becomes a member when `users.member` points at a member row. | A user. Every member is reached through a user, but most users (applicants) are not members. |
| member directory | The dashboard's list of members with their user data, roles, departments and divisions, built in `getMemberDirectoryRows` ([app/actions/get-members.ts](../app/actions/get-members.ts)). About 150 rows; [0003](../.decisions/0003-neon-direct-pooled.md) requires it be read from a cache. | |
| NDA | The confidentiality agreement a member signs: `members.nda_signed_at`, `nda_name` (the name signed) and `nda_confirmed_by` (the member id of who confirmed it) ([db/schema/public.ts](../db/schema/public.ts)). | |
| org structure | The tree of departments and their divisions, read once and cached under the `org-structure` cache tag ([app/actions/get-member-scopes.ts](../app/actions/get-member-scopes.ts)). | |
| PoliTo | Politecnico di Torino, the team's university. `users.polito_id` is the student's university id. | PRT. PoliTo is the university, PRT is the team. |
| PRT | PoliTo Rocket Team, the team itself. `members.prt_email` is the member's team address, separate from the personal `users.email`. | PoliTo. |
| role | One member's post in a department or division over a date range: `roles` table, with `title`, `type`, `started_at` and `leaved_at` ([db/schema/public.ts](../db/schema/public.ts)). A member can hold many roles. | A scope (what a member may see or edit in the dashboard). An apply position (an opening to recruit for). |
| role type | The rank of a role: `president`, `head`, `lead` or `core`, on `roles.type`. The Postgres enum is named `position_type` (`positionTypeEnum`), though it types a role, not a position ([db/schema/public.ts](../db/schema/public.ts)). | An apply position. The enum name says "position"; the thing it ranks is a role. |

## Accounts and access

| Term | Definition | Not |
|---|---|---|
| access level | How far a scope reaches on its target: `view` or `edit`, default `view` (`access_level_type` enum, [db/schema/public.ts](../db/schema/public.ts)). | |
| Better Auth user | The sign-in identity in the `better_auth` Postgres schema: table `better_auth.user` (`betterAuthUsers`), with its sessions, accounts and verifications ([db/schema/better-auth.ts](../db/schema/better-auth.ts), [lib/auth.ts](../lib/auth.ts)). Sign-in is email and password, or Google. | A user. The Better Auth user is the login; the user is the profile row a trigger copies it into. |
| scope | One access grant to a member: `scopes` table, with a scope type (`admin`, `org`, `department`, `division`, `website`), a target, an access level, an optional department or division, and `given_by` (the member who granted it) ([db/schema/public.ts](../db/schema/public.ts)). The column holding the scope type is also named `scope`. | A role. Also not the OAuth `scope` column on `better_auth.account`. |
| scope info | One member's scopes folded for a single target into flags (`hasAdminAccess`, `hasOrgAccess`, and their edit twins) and sets of department and division ids ([app/actions/get-member-scopes.ts](../app/actions/get-member-scopes.ts)). Dashboard reads filter by it. The `website` scope type is ignored when folding. | |
| scope rank | A ranking of scope types with a minimum per target, in `SCOPE_RANK` and `TARGET_MIN_REQUIREMENTS` ([lib/permission.config.ts](../lib/permission.config.ts)). Nothing imports it, and it lists `core_member`, which the `scope_type` enum does not have, while it lacks `website`. | Scope info, which is what the dashboard actually checks. |
| target | The dashboard area a scope covers: `all`, `positions`, `applications`, `members`, `orders`, `faq`, `blog` or `logs` (`target_type` enum, [db/schema/public.ts](../db/schema/public.ts)). `all` matches every target. | |
| user | A person's profile row: `public.users`, with name, study data, PoliTo id, program, and an optional link to a member ([db/schema/public.ts](../db/schema/public.ts)). A trigger, `sync_public_users_from_better_auth_user`, creates or updates it from the Better Auth user by id or email ([drizzle/0001_sync_better_auth_user_ids.sql](../drizzle/0001_sync_better_auth_user_ids.sql)). Applicants are users. | A Better Auth user. A member. |

## Recruiting

| Term | Definition | Not |
|---|---|---|
| application | One user's request to join through one apply position: `applications` table, with a CV, a motivation letter, custom answers and an application status ([db/schema/public.ts](../db/schema/public.ts)). The approved redesign has no apply form on the site: `/apply` lists open positions and links out to the university's application site ([design/project-notes.md](../design/project-notes.md)). | |
| application file | An uploaded CV or motivation letter: `application_files` table, stored in object storage under `r2_key`, with original filename, type, size and hash ([db/schema/public.ts](../db/schema/public.ts)). An application points at up to two of them. | |
| application status | Where an application stands: `received` (the default), `pending`, `accepted`, `rejected` or `accepted_by_another_team` (`application_status` enum, [db/schema/public.ts](../db/schema/public.ts)). | Order status, an unrelated enum whose Postgres name is just `status`. |
| apply position | A recruiting opening in one division: `apply_positions` table (`ApplyPosition` in code), with title, description, required and desirable skills, custom questions and whether a motivation letter is required ([db/schema/public.ts](../db/schema/public.ts)). `status` is a boolean (true means active) and `is_deleted` hides it for good. The dashboard route, the scope target and the UI all say "position". | A role or role type. |
| custom question | A free-text question an apply position asks (`apply_positions.custom_questions`); the applicant's replies are stored on the application as `custom_answers` ([db/schema/public.ts](../db/schema/public.ts)). | |
| motivation letter | The letter file an application may carry, required when the apply position sets `requires_motivation_letter`. Code also calls it `ml` (`ml_name`) and, in the foreign key, cover letter (`cover_letter_file_id`); all three are one file. | A separate cover letter. There is only one letter. |
| open position | An apply position with `status` true and not deleted, the set the public `/apply` page and the "positions open now" count read ([app/actions/get-apply-positions.ts](../app/actions/get-apply-positions.ts), [components/landing/apply-band.tsx](../components/landing/apply-band.tsx)). | Any apply position. Inactive and deleted ones are not open. |
| similar application | In the dashboard, an application from a different user whose name matches or contains this applicant's name, shown as a possible duplicate ([app/actions/get-applications.ts](../app/actions/get-applications.ts)). | Other applications: those come from the same user. |

## Operations

| Term | Definition | Not |
|---|---|---|
| audit log | The `logs` table: one row per insert, update or delete in the `public` and `better_auth` schemas, with old and new data and `changed_by` (a user id), written by the `log_db_changes` trigger ([drizzle/0003_logs_changed_by_user_fk.sql](../drizzle/0003_logs_changed_by_user_fk.sql)). | |
| order | A member's purchase request: `orders` table, with item name, quantity, price, reason, a quote file name and a status of `pending`, `accepted` or `rejected` ([db/schema/public.ts](../db/schema/public.ts)). | |

## Public site

| Term | Definition | Not |
|---|---|---|
| dashboard | The members' area behind sign-in, under `/dashboard`: applications, positions and members ([design/project-notes.md](../design/project-notes.md)). Today its pages sit in the legacy route group. | |
| partner | A company whose logo runs in the Partners section and on `/partners` ([components/landing/partners.tsx](../components/landing/partners.tsx)). The logo files sit in folders named `sponsors/`, and [0005](../.decisions/0005-vercel-hobby-accept-non-commercial-clause.md) says "sponsor logos": both mean partner. Static list for now. | A separate sponsor concept. Sponsor is the old name for the same thing. |
| post | A news item in the landing "Latest" section: tag (Launch, Competition, Outreach or Team), date, title, excerpt, optional image ([components/landing/latest.tsx](../components/landing/latest.tsx)). Planned to come from a posts table written in the dashboard; static today. | |
| project | One of the team's engineering programmes: Cavour, VES and Efesto. There are three: VES Mark I and Mark II are versions of one project, and Efesto is an engine, not a vehicle ([design/specs-from-old-site.md](../design/specs-from-old-site.md), [design/HANDOFF.md](../design/HANDOFF.md)). The landing cards and footer still show four entries. | A vehicle. A version. |
| vehicle | A rocket that flies within a project: Cavour and VES. Efesto has no vehicle ([design/specs-from-old-site.md](../design/specs-from-old-site.md)). | A project. |
| version | One build of a vehicle: VES Test Version, Mark I and Mark II. Cavour's builds are called configs instead (CVR 100-75-3, -75-4, -54-6) ([design/specs-from-old-site.md](../design/specs-from-old-site.md)). | A project. |
