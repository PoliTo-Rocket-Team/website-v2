# Dashboard guide

A tour of the dashboard (`/dashboard`): what each page is for and who uses it. It is a map, not
the rulebook; the exact rules (who sees what, every status, every lock) are in
[dashboard-rules.md](dashboard-rules.md). For how the dashboard fits into the whole site, see
[How the website works](how-the-website-works.md).

## Who is who

Everyone signs in with Google. What a person sees depends on where they sit in the team:

- **Non-member**: signed in but not on the team, usually an applicant.
- **Alumni**: left the team. They see only their own pages.
- **Member**: on the team, in one or more divisions.
- **Division lead** and **department head**: run their own division or department.
- **Full access**: the team leader and the team-wide seats (operations, IT, Project Manager, Chief
  Engineer, Logistics). They see and act on the whole team.
- **Advisor**: someone who handed over a lead or head seat and stayed on to help. It leads nothing
  by itself.

Every seat can have several holders, and each holder has the seat's full rights.

On top of the role, a person can get **access grants**: an extra right on one area (for example
Content, or "Approve orders"), for one division, one department or the whole team. A grant gives
only that area; it never makes someone a lead.

Everyone uses the same pages. A lead and the team leader open the same Members page; the lead
just sees their own divisions and fewer actions. An action someone may not take shows as locked,
with the reason.

## The pages

### For everyone

- **Overview**: the landing page. Your name, your place in the team, your open applications and
  anything waiting on you.
- **My applications**: your own applications and their status, while one is open or recently
  decided.
- **My profile** (members) or **My account** (others): your photo, contact details, linked Google
  accounts, and your PRT email. From the user menu.

### For alumni

- **My alumni**: the years and roles the public Alumni page shows for you.

### People

- **Team tree**: the team as departments, divisions and seats. Leads and heads use it to add,
  move, promote and hand over people, to open or close divisions, and to change seat holders.
- **Members**: the same people as a list (the team leader also gets a table view and an Excel
  export). Opening a person shows their details and roles; the same member actions as in the Team
  tree are here: edit details, move, remove from a division, becomes an advisor, leaves the team.
- **Alumni**: the people the public Alumni page lists, including current members' past years.
  Editors fix names and years, and can add a year the team record lacks.

### Recruitment

- **Positions**: the open roles per division, and (for full access) the site-wide switch that
  opens or closes recruitment on the Apply page.
- **Applications**: everyone who applied to your divisions. Reviewers move each application
  through its steps (new, interview, accepted or rejected, joined), and an accepted person joins
  the team from here.

### Content (needs the Content grant, or full access)

- **Outreach**: the news posts. Each post has a published version and a draft; editing changes
  the draft, and **Publish** makes it live. One post can be pinned as the featured post.
- **Projects**: the project pages (Cavour, VES, Efesto): fixed sections with text, photos, launch
  data and the background image.
- **Partners**: sponsor logos and links, in their tiers.
- **FAQ**: the questions on the Apply page.
- **Team page**: the layout of the public Team page: which seats show where, the intro text,
  figures and the group photo.

### Running the team

- **Orders**: purchase requests. People in a division raise them; leads and heads edit their own
  unit's orders, and holders of "Approve orders" decide them.
- **Access**: who holds which access grant, per division, department or the whole team.
- **Activity log** (IT lead only): a record of every change made in the dashboard, by whom and when.

## Things that work the same everywhere

- **Photos**: every image upload goes through one upload and crop flow. A photo shown in several
  shapes (for example a card and a header) gets one crop per shape, and a stored photo can be
  re-cropped without uploading it again.
- **Saving**: lists and side panels show a change as soon as it is saved, with no reload.
- **View as** (team leader): see the dashboard exactly as another person sees it, to check what
  they can do. A banner shows while it is on; **Stop** returns to your own view.
- **Previews**: on a preview deployment, a tester sign-in lets you act as one of the seeded dummy
  people. Changes there go to the preview database, never to the live site.
