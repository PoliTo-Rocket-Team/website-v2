# Seed cases

The dummy set that `pnpm db:seed` loads into a local database and into the one Neon branch every preview reads, named `preview` ([ADR 0016](../.decisions/0016-previews-read-their-own-seeded-branch.md)). This page lists every case the set holds and the board or issue that case exercises, so a reviewer knows where to look and a maintainer knows what a change to the seed may break.

## How the seed runs

- `pnpm db:seed` runs [db/seed.ts](../db/seed.ts). It checks the target first, then runs every module in [db/seed/registry.ts](../db/seed/registry.ts) in one transaction: each module's reset (last module first), then each module's insert (in order). Running it twice leaves the same rows, including columns a default or a trigger fills. It leaves the audit table `logs` empty.
- The seed sends each value the way drizzle maps it, as the app does: a json or jsonb value is encoded once, so an array is stored as an array ([db/seed/connection.ts](../db/seed/connection.ts)).
- `pnpm db:seed --check` runs the target check alone and writes nothing.
- The check reads `DATABASE_URL` and allows only these targets:
  - a local database (`localhost`, `127.x.x.x` or `::1`);
  - the shared Neon branch named `preview`, known by its compute endpoint `ep-floral-mouse-b2er5ebz` in the connection host (the direct host or the `-pooler` one), and only on a Vercel preview build (`VERCEL_ENV` is `preview`).
  The check reads the host alone. It calls no Neon API and needs no Neon key.
- It refuses everything else: a Vercel production build, any other Neon endpoint (production's among them), any host it cannot classify, and the `preview` branch's endpoint outside a preview build. No variable or flag turns a refusal into a pass. The rules, and the endpoint id, are in [lib/seed/target.ts](../lib/seed/target.ts). If the `preview` branch is ever recreated, its new endpoint id replaces that one constant.
- A preview build seeds the `preview` branch itself: `pnpm build` runs [db/preview-build.ts](../db/preview-build.ts) before `next build`. On a Vercel preview build given a `DATABASE_URL`, it checks the target, then migrates and re-seeds it under a Postgres advisory lock, so concurrent preview builds take turns. Production and development builds, local builds and a preview with no database skip it. A refusal or failure fails the preview build.
- No agent runs the seed or a migration against any real database.

## Row format

Each row is one seeded case. An area slice that adds a seed module adds its rows here in the same change, and the same case, with a check that proves it from the seeded rows, to `SEED_CASES` in [db/seed/cases.ts](../db/seed/cases.ts). A unit test runs every check and fails when this table and that list differ.

| Column | What goes in it |
|---|---|
| Area | The seed module that holds the case, by its `name` in the registry (for example `structure`). |
| Case | The situation in plain words (for example "a closed division with no members"). |
| Rows | How to find the rows: table and key (for example `divisions` code `OLD`). |
| Exercised by | The board or issue whose page shows the case, as a link. |

## Cases

| Area | Case | Rows | Exercised by |
|---|---|---|---|
| structure | A closed division, kept as a name, with nobody in it now | `divisions` code `HYB` | [#251](https://github.com/PoliTo-Rocket-Team/website-v2/issues/251), [#257](https://github.com/PoliTo-Rocket-Team/website-v2/issues/257) |
| structure | An open division with nobody in it | `divisions` code `PLI` | [#251](https://github.com/PoliTo-Rocket-Team/website-v2/issues/251) |
| people | One team leader | `roles` type `president`, member 1 | [#247](https://github.com/PoliTo-Rocket-Team/website-v2/issues/247), [#252](https://github.com/PoliTo-Rocket-Team/website-v2/issues/252) |
| people | A Project Manager and a Chief Engineer, the two board seats, so the roles fill every section of the Team page | `roles` titled by the seat, members 52 and 53 | [#282](https://github.com/PoliTo-Rocket-Team/website-v2/issues/282), [#311](https://github.com/PoliTo-Rocket-Team/website-v2/issues/311) |
| people | One operations lead and one IT lead, the two full-access seats | `roles.full_access`, members 903 and 11 | [#238](https://github.com/PoliTo-Rocket-Team/website-v2/issues/238), [#252](https://github.com/PoliTo-Rocket-Team/website-v2/issues/252) |
| people | A head in every open department | `roles` type `head` | [#252](https://github.com/PoliTo-Rocket-Team/website-v2/issues/252) |
| people | A lead in every open division that has people | `roles` type `lead` with a `division_id` | [#251](https://github.com/PoliTo-Rocket-Team/website-v2/issues/251), [#252](https://github.com/PoliTo-Rocket-Team/website-v2/issues/252) |
| people | Members with no lead role | `roles` type `core` | [#252](https://github.com/PoliTo-Rocket-Team/website-v2/issues/252) |
| people | A member in two divisions at once | `roles` of member 15 | [#251](https://github.com/PoliTo-Rocket-Team/website-v2/issues/251), [#252](https://github.com/PoliTo-Rocket-Team/website-v2/issues/252) |
| people | An advisor in a division, a former lead who stayed | `roles` type `advisor`, member 43 | [#251](https://github.com/PoliTo-Rocket-Team/website-v2/issues/251), [#253](https://github.com/PoliTo-Rocket-Team/website-v2/issues/253) |
| people | A team-level advisor: the former team leader, in no department or division | `roles` type `advisor`, member 40 | [#253](https://github.com/PoliTo-Rocket-Team/website-v2/issues/253), [#257](https://github.com/PoliTo-Rocket-Team/website-v2/issues/257) |
| people | One seeded person per test viewer, read as that viewer | `TEST_VIEWER_PEOPLE` in `db/seed/people.ts` | [#247](https://github.com/PoliTo-Rocket-Team/website-v2/issues/247) |
| alumni | People who left in each year from 2021–22 to 2025–26 | `roles.leaved_at`, members 40–51 | [#257](https://github.com/PoliTo-Rocket-Team/website-v2/issues/257), [#271](https://github.com/PoliTo-Rocket-Team/website-v2/issues/271) |
| alumni | A founder and a co-founder mark | `alumni_entries.founder`, members 41 and 42 | [#257](https://github.com/PoliTo-Rocket-Team/website-v2/issues/257) |
| alumni | A hidden alumnus | `alumni_entries` member 47, `shown` false | [#257](https://github.com/PoliTo-Rocket-Team/website-v2/issues/257) |
| alumni | An alumnus whose account is deleted and anonymized, with the Alumni entry kept | `users` and `members` 48, `alumni_entries` member 48 | [#191](https://github.com/PoliTo-Rocket-Team/website-v2/issues/191), [#257](https://github.com/PoliTo-Rocket-Team/website-v2/issues/257) |
| alumni | An alumnus who asked to be removed from the Alumni page | `alumni_entries` member 49, `removed_at` set | [#257](https://github.com/PoliTo-Rocket-Team/website-v2/issues/257) |
| alumni | A name fixed for the Alumni page | `alumni_entries` member 50, `name` set | [#257](https://github.com/PoliTo-Rocket-Team/website-v2/issues/257) |
| alumni | A former member read as the alumni test viewer: every role ended, an Alumni entry kept | `TEST_VIEWER_PEOPLE` alumni, member 50 | [#317](https://github.com/PoliTo-Rocket-Team/website-v2/issues/317) |
| access | Grants across the whole team | `scopes` scope `team`, members 7 and 9 | [#247](https://github.com/PoliTo-Rocket-Team/website-v2/issues/247) |
| access | Grants in one department | `scopes` scope `department`, members 14 and 30 | [#247](https://github.com/PoliTo-Rocket-Team/website-v2/issues/247) |
| access | Grants in one division | `scopes` scope `division`, members 28 and 22 | [#247](https://github.com/PoliTo-Rocket-Team/website-v2/issues/247) |
| access | Grants at view and at edit | `scopes.access_level` | [#247](https://github.com/PoliTo-Rocket-Team/website-v2/issues/247) |
| access | A member who holds "Approve orders" and nothing else | `scopes` target `approve_orders`, member 24 | [#270](https://github.com/PoliTo-Rocket-Team/website-v2/issues/270) |
| access | Alumni access, given across the whole team | `scopes` scope `website`, member 36 | [#247](https://github.com/PoliTo-Rocket-Team/website-v2/issues/247), [#257](https://github.com/PoliTo-Rocket-Team/website-v2/issues/257) |
| orders | An order in every status: waiting, changes requested, rejected, approved, ordered and cancelled | `orders` 1–7 | [#172](https://github.com/PoliTo-Rocket-Team/website-v2/issues/172), [#247](https://github.com/PoliTo-Rocket-Team/website-v2/issues/247) |
| orders | Orders made for divisions in different departments | `orders.division_id` | [#233](https://github.com/PoliTo-Rocket-Team/website-v2/issues/233), [#247](https://github.com/PoliTo-Rocket-Team/website-v2/issues/247) |
| orders | An order approved by the member who holds "Approve orders" and nothing else | `orders` 5, `reviewed_by` member 24 | [#270](https://github.com/PoliTo-Rocket-Team/website-v2/issues/270) |
| recruitment | Recruitment is on | `recruitment_setting.is_open` | [#119](https://github.com/PoliTo-Rocket-Team/website-v2/issues/119) |
| recruitment | Open and closed positions | `apply_positions.status`; closed: 13, 18 and 23 | [#119](https://github.com/PoliTo-Rocket-Team/website-v2/issues/119), [#171](https://github.com/PoliTo-Rocket-Team/website-v2/issues/171) |
| recruitment | An application in every stage: new, in review, interview, accepted, joined, rejected and withdrawn | `applications`, `interview_slots` | [#169](https://github.com/PoliTo-Rocket-Team/website-v2/issues/169), [#171](https://github.com/PoliTo-Rocket-Team/website-v2/issues/171) |
| recruitment | An application in every stored status, "accepted by another team" among them | `applications.status` | [#171](https://github.com/PoliTo-Rocket-Team/website-v2/issues/171) |
| recruitment | An interview with times offered and none booked, and one the applicant booked | `interview_slots` of applications 5 and 6 | [#169](https://github.com/PoliTo-Rocket-Team/website-v2/issues/169), [#186](https://github.com/PoliTo-Rocket-Team/website-v2/issues/186) |
| recruitment | Accepted applications waiting for the signed NDA, and with the NDA arrived | `applications` 3 and 1 | [#171](https://github.com/PoliTo-Rocket-Team/website-v2/issues/171) |
| recruitment | The local applicant tester holds applications to act on | `applications` 24 and 25 | [#129](https://github.com/PoliTo-Rocket-Team/website-v2/issues/129), [#169](https://github.com/PoliTo-Rocket-Team/website-v2/issues/169) |
| partners | Main and media partners on the public pages | `partner_versions.tier` | [#256](https://github.com/PoliTo-Rocket-Team/website-v2/issues/256) |
| partners | A published partner with draft changes | `partner_versions` of partner 3 (EvoMisure) | [#256](https://github.com/PoliTo-Rocket-Team/website-v2/issues/256) |
| partners | A draft partner, never published, so the public pages do not show it | `partner_versions` of partner 14 | [#256](https://github.com/PoliTo-Rocket-Team/website-v2/issues/256) |
| partners | A published partner with no website | `partner_versions` of partner 10 (Magicar) | [#256](https://github.com/PoliTo-Rocket-Team/website-v2/issues/256) |
| partners | A published partner with a dark logo, drawn white | `partner_versions.logo_dark`, partners 11 and 12 | [#256](https://github.com/PoliTo-Rocket-Team/website-v2/issues/256) |
| faq | Published questions on /apply | `faq_versions` version `published` | [#258](https://github.com/PoliTo-Rocket-Team/website-v2/issues/258) |
| faq | A published question with a draft change that /apply does not show | `faq_versions` of question 3 | [#258](https://github.com/PoliTo-Rocket-Team/website-v2/issues/258) |
| outreach | Every tag in the tag list on at least one published post, Award the one award tag | `outreach_tags`, `outreach_post_tags.tag_name` | [#287](https://github.com/PoliTo-Rocket-Team/website-v2/issues/287), [#290](https://github.com/PoliTo-Rocket-Team/website-v2/issues/290) |
| outreach | Every channel type on a published post: Instagram, LinkedIn, YouTube, Facebook, X, TikTok and Other link | `outreach_post_versions.channels` of post 14 | [#290](https://github.com/PoliTo-Rocket-Team/website-v2/issues/290), [#278](https://github.com/PoliTo-Rocket-Team/website-v2/issues/278) |
| outreach | A post first shared by another account | `outreach_post_versions.channels` `account`, posts 3, 5 and 14 | [#290](https://github.com/PoliTo-Rocket-Team/website-v2/issues/290) |
| outreach | Published posts enough for the home Track record's featured card and three news cards | `outreach_post_versions` version `published` | [#293](https://github.com/PoliTo-Rocket-Team/website-v2/issues/293), [#289](https://github.com/PoliTo-Rocket-Team/website-v2/issues/289) |
| outreach | Every photo with alt text, and a post with several photos for the photo grid | `outreach_post_versions.photos`, post 14 | [#291](https://github.com/PoliTo-Rocket-Team/website-v2/issues/291) |
| outreach | A published post with draft changes that the public pages do not show | `outreach_post_versions` of post 4 (IAC 2024, Milan) | [#287](https://github.com/PoliTo-Rocket-Team/website-v2/issues/287), [#290](https://github.com/PoliTo-Rocket-Team/website-v2/issues/290) |
| outreach | A new post saved as a draft before it is whole, never published, so the public pages do not show it | `outreach_post_versions` of post 15 | [#292](https://github.com/PoliTo-Rocket-Team/website-v2/issues/292) |
| outreach | The featured summit, published, with its editions | `outreach_summit_versions` version `published` | [#287](https://github.com/PoliTo-Rocket-Team/website-v2/issues/287), [#289](https://github.com/PoliTo-Rocket-Team/website-v2/issues/289) |
| projects | Published projects on /projects, the home Projects cards and their pages, in site order | `project_versions` version `published`, projects 1–4 | [#295](https://github.com/PoliTo-Rocket-Team/website-v2/issues/295), [#299](https://github.com/PoliTo-Rocket-Team/website-v2/issues/299) |
| projects | A published project with draft changes that its pages do not show | `project_versions` of project 2 (VES) | [#297](https://github.com/PoliTo-Rocket-Team/website-v2/issues/297), [#298](https://github.com/PoliTo-Rocket-Team/website-v2/issues/298) |
| projects | A published project with no rocket model of its own, so its card and its page draw the placeholder rocket | `project_versions` of project 4 (Galileo) | [#296](https://github.com/PoliTo-Rocket-Team/website-v2/issues/296), [#301](https://github.com/PoliTo-Rocket-Team/website-v2/issues/301) |
| hand-overs | A division lead's hand-over waiting for the head of their department, on the department-head test viewer's Overview | `hand_over_requests` 2, member 20 to member 29 | [#262](https://github.com/PoliTo-Rocket-Team/website-v2/issues/262) |
| hand-overs | A confirmed hand-over: the lead became an advisor in the division and their access ended | `hand_over_requests` 1, member 43 to member 16 | [#253](https://github.com/PoliTo-Rocket-Team/website-v2/issues/253), [#262](https://github.com/PoliTo-Rocket-Team/website-v2/issues/262) |
| team-page | The team leader's photo replaced on the page | `team_page_layer_versions` published, `leader.photo` | [#283](https://github.com/PoliTo-Rocket-Team/website-v2/issues/283), [#284](https://github.com/PoliTo-Rocket-Team/website-v2/issues/284) |
| team-page | A head's role text changed on the page | `team_page_layer_versions` published, `spots` `head:4:0`, member 8 | [#283](https://github.com/PoliTo-Rocket-Team/website-v2/issues/283), [#285](https://github.com/PoliTo-Rocket-Team/website-v2/issues/285) |
| team-page | A leader added on the arc between the Project Manager and the Chief Engineer | `team_page_layer_versions` published, `addedLeaders` 1, member 21 | [#283](https://github.com/PoliTo-Rocket-Team/website-v2/issues/283), [#285](https://github.com/PoliTo-Rocket-Team/website-v2/issues/285) |
| team-page | A division lead hidden from the page | `team_page_layer_versions` published, `spots` `lead:9:0`, member 23 | [#283](https://github.com/PoliTo-Rocket-Team/website-v2/issues/283), [#285](https://github.com/PoliTo-Rocket-Team/website-v2/issues/285) |
| team-page | A division lead added to a department whose one division has nobody in it | `team_page_layer_versions` published, `departments` 8 `addedLeads`, member 25 | [#283](https://github.com/PoliTo-Rocket-Team/website-v2/issues/283), [#285](https://github.com/PoliTo-Rocket-Team/website-v2/issues/285) |
| team-page | The intro text and the group photo's caption changed, which Reset to team keeps | `team_page_layer_versions` published, `intro` and `groupPhoto` | [#283](https://github.com/PoliTo-Rocket-Team/website-v2/issues/283), [#284](https://github.com/PoliTo-Rocket-Team/website-v2/issues/284) |
| team-page | One principal advisor and several specialists, each published | `team_page_advisors` 1–5 | [#286](https://github.com/PoliTo-Rocket-Team/website-v2/issues/286) |

The five local testers of issue #129 are seeded by the `people` module, with the ids and emails in [lib/dev-tester.ts](../lib/dev-tester.ts). The draft partner borrows the Team's own mark as a stand-in logo, since the seed uploads no file. The Outreach seed starts from the posts, tags and summit the import migration carries in; post 14 is a seeded post whose channel links point at `example.com`, with the warm stand-in photo a preview shows for an upload as its cover. The Projects seed starts from Cavour, VES and Efesto as the import migration carries them in; VES holds draft changes to its intro and to the line on the page before it, and Galileo is published as New project makes it, with starting copy and no rocket model of its own. The `hand-overs` module runs after `people`, so no role it writes closes the waiting hand-over. The `team-page` module writes only the Team page's visual layer and its advisors, never a role: every edit is keyed to a spot the seeded roles fill and names someone on the team, so "Reset to team" brings back the page the roles build and keeps the advisors, the intro text and the group photo. The team leader's replaced photo borrows a portrait from the record as a stand-in, since the seed uploads no file. The `audit` module runs last and leaves `logs` empty.

## Connect previews to the preview database branch

This is an owner action. Agents never change a Vercel, Neon or repository setting or an environment variable; the build only documents the setup. The owner finished it on 2026-10-16 (recorded on [#306](https://github.com/PoliTo-Rocket-Team/website-v2/issues/306)), in this shape:

1. **Preview branching is off on the integration.** The Neon integration for Vercel does not create a branch for each preview deployment. Its connection to website-v2 covers **Production** and **Development** only. The integration cannot choose a parent branch for previews, so it is not used for them.
2. **One schema-only branch named `preview`.** In the Neon console, in the same project, a branch named `preview` was created from `main` with the **Schema only** option. It holds the tables and no rows, so it never holds production data. Its compute endpoint is `ep-floral-mouse-b2er5ebz`, the one Neon endpoint the seed's target check allows.
3. **Preview-only connection strings.** In Vercel, **Project → Settings → Environment Variables**, `DATABASE_URL` (the pooled string) and `DATABASE_URL_UNPOOLED` (the direct string) point at the `preview` branch, with only the **Preview** environment ticked. No production connection string is set for Preview.

The target check needs no other variable: it knows the `preview` branch by the endpoint in these two strings, so it needs no Neon API key and no project id (Owner decision on [#311](https://github.com/PoliTo-Rocket-Team/website-v2/issues/311)).

Every preview deployment shares the `preview` branch. Each preview build migrates it and re-seeds it, so it holds only the dummy set, never production rows, and the last preview build's seed is what every preview reads. A preview's changes last only until the next preview build, and a pull request's migration reaches the shared branch before it merges. On a preview with this database, the pages read it, and the test developer's viewers are the seeded people in [lib/test-viewer-people.ts](../lib/test-viewer-people.ts); a test developer's writes are saved there as that seeded person, and refused outside a preview. A preview with no `DATABASE_URL` keeps reading the dummy arrays in `lib/dummy-data/`.
