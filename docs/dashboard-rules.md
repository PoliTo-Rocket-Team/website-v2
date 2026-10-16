# Dashboard rules

What each person sees in the dashboard, and the rules behind each action. Read this before any
dashboard work. The rules come from Huey's rulings on #141, #168, #169, #170, #171, #172 and #179.

Each rule is stated as Huey ruled it. Where the merged code does not follow a rule yet, a
**Gap** line under it names the open issue that tracks the fix. A rule whose feature is not
built yet is marked **Planned**.

## 1. Who sees what

The five people:

- **Non-member**: signed in, not on the team (an applicant).
- **Member**: on the team.
- **Division lead**: leads one or more divisions.
- **Department head**: heads a department and all its divisions.
- **Full access**: the team leader, the operations lead and the IT lead. They see and act on the
  whole team (see "Full access" below).

An **advisor** (#253) is someone who handed over a role and stayed in the team (see "Handing
over a role" below). The Advisor role leads nothing and heads nothing: it is never counted as a
lead or a head, so an advisor reaches a member's pages, plus whatever their access rows give
them. A former team leader who became an advisor keeps full access through an access row.

An admin column comes later. **Planned**, no issue yet.

| Sidebar item or page | Non-member | Member | Division lead | Department head | Full access |
|---|---|---|---|---|---|
| My applications | Yes, only with at least one application | Yes, only with at least one application | Yes, only with at least one application | Yes, only with at least one application | Yes, only with at least one application |
| Overview | Yes, only with at least one application | Yes | Yes | Yes | Yes |
| Team tree | No | Yes | Yes | Yes | Yes |
| Positions | No | No | Own divisions | All divisions in the department, under division tabs | All, plus the site-wide recruitment switch; the team leader also has a division select |
| Applications | No | No | Own divisions | All divisions in the department, under division tabs | All; the team leader has department and division selects |
| Members | No | No | Their divisions | Their divisions | The whole team; the team leader's has a List and a Table view |
| Partners | No | Only with site-content access | Only with site-content access | Only with site-content access | Yes; the team leader's sidebar shows it under Content |
| Alumni | No | Only with site-content access | Only with site-content access | Only with site-content access | Yes; the team leader's sidebar shows it under Content |
| FAQ | No | Only with site-content access | Only with site-content access | Only with site-content access | Yes; the team leader's sidebar shows it under Content |
| Access | No | No | Their divisions | Their department, under division tabs | The whole team, under department tabs |
| Orders | No | No | Every order in the team; edits their divisions' | Every order in the team; edits their department's | Every order in the team; edits every order |
| Activity log | No | No | No | No | The IT lead only |
| My account | User menu only | No | No | No | No |
| My profile | No | User menu only | User menu only | User menu only | User menu only |
| Sign out | User menu only | User menu only | User menu only | User menu only | User menu only |

- **My applications** shows for everyone, but only when they have at least one application.
- A non-member with no application lands on the My applications empty state, with a
  "See open positions" button (#179).
- **Full access** comes from the role alone, with no scope row (Owner decisions, 2026-10-11,
  #238). Three seats hold it:
  - the **team leader**: the role of type `president`;
  - the **operations lead** and the **IT lead**: each seat's role carries a full-access flag
    (`roles.full_access`, migration 0018), set once in the data. The seat is never read from a
    department or division code, or from a title, because codes change.
  - Full access reaches every page in the table, in every department and every division. On
    Access and Orders it sees and acts on the whole team, and it can give any access to anyone.
  - An `admin` or `org` scope row still gives full access, as before.
  - **Exception 1, deciding orders:** by default only the team leader approves, rejects or asks
    for changes. The operations lead and the IT lead decide only with "Approve orders" (see
    "4. Orders").
  - **Exception 2, the Activity log:** only the IT lead reaches it. The reach rule is in place;
    the page itself is **Planned**, so no sidebar lists it yet.
- **The team leader's own pages** (boards 72 to 73c, #252). The team leader has full access like
  the operations lead and the IT lead, but some of their pages differ. The operations lead and the
  IT lead keep boards 40 and 46.
  - **Sidebar:** Overview and Team tree, then RECRUITMENT (Positions, Applications), TEAM
    (Members, Access, Orders) and CONTENT. CONTENT holds the content pages that exist; today that
    is Partners, Alumni, then FAQ. Each content page adds its own row there.
  - **Overview (board 72):** four figures: new applications, open positions, orders waiting for
    the team leader's decision, and the team's size. "Needs your attention" lists, in this order:
    the orders waiting for a decision (one row, naming the oldest, with Review) and the approved
    orders not ordered yet (one row, naming up to three items, with Open). Stored notices follow.
    The orders rows show counts and items, never a price. A Departments panel lists each department with its head, its
    divisions and people, and its new applications and open positions. Recent activity has no
    Activity log link.
  - **Members, List view (board 73):** the whole team, with an "All departments" select, an
    "All divisions" select (the chosen department's divisions), and a search over name, email and
    phone. Heads and leads come first: the team leader, the board seats, department heads,
    division leads, then members, by name within each. Each row shows the member, their division
    codes (a head shows the codes of their department's divisions) and their role. There is no
    Phone or Discord column; those stay in the member panel, which opens read only from a row.
    There is no New division, New department or Closed divisions control here. Pages of eight.
  - **Members, Table view (boards 73b, 73c):** every member field: name, divisions, role, PRT
    email, phone, Discord, PoliTo ID, program, level, from, date of birth, gender and NDA. The
    name column stays pinned; the table fills the screen and scrolls both ways, with no pages.
    Phone, date of birth and gender stay blurred until hover. Divisions, Role, Program, Level,
    From, Gender and NDA each have a filter: a search, a tick and a count per value, Clear, and
    "N selected". Within a column any ticked value matches; across columns all must.
  - **Positions and Applications:** as the operations lead's, with "All departments" and "All
    divisions" selects, as on the department head's boards 63 and 64. New position lists every
    division of the team.
- **Overview** is for members, division leads, department heads and the operations lead, and for
  a non-member with at least one application, withdrawn ones included (boards 50e and 50e-m,
  #211). A non-member whose only applications are withdrawn stays on the Overview: the "Your
  applications" panel shows one line, "No open applications.", with its "Open My applications"
  link, and the withdrawn applications stay under Past on My applications (Owner decision, #227).
- **Team tree** is for members and up.
- **Positions** and **Applications**: a division lead sees their own divisions. A department head
  sees all divisions in their department and picks one with division tabs. The operations
  lead sees all of them, plus the site-wide recruitment switch.
  - A person whose current role has type `head` is a department head. Their role's department
    (`roles.dept_id`, or the department of the role's division) covers every open division of
    it, with no `department` scope row needed (#230).
  - The head's Positions, Applications and Access pages have division tabs: "All divisions"
    first, then each division with its count. Every page starts on "All divisions" (Owner
    decision, #230). On a phone the tabs are one "All divisions" pill that opens the same choice.
  - A division lead of one division sees no tabs.
  - New position: the division select lists only the head's department's divisions. When a
    division tab is open, the drawer starts with that division picked; on "All divisions" the
    head picks one (Owner decision, #230).
  - The head's Overview adds a Divisions panel: one row per division, with its leads, its people,
    and its new applications and open positions (board 62). A row opens that division's tab on
    Positions.
  - **Gap:** any access grant, even view-only, makes a member act as a division lead on
    applications. Tracked in #160.
- **Members** and **Access** are for division leads and up, scoped to their divisions. A lead of
  more than one division picks which one Members shows (#231). **Orders** shows every order in
  the team; see "4. Orders".
  - **Gap:** a lead of more than one division sees only one on Access. Tracked in #185.
  - A department head's Members page holds every division of their department (#235).
- **Alumni** is where the team checks the public site's alumni content. By default the full
  admins see it: the operations lead, the team leader and the IT lead. Anyone else sees it only
  with site-content access, which the full admins can give to anyone. A division lead or
  department head gets nothing from their role here (Owner decision, #234). The sidebar item and
  the page read one rule, and the page answers "not found" to everyone else.
  - Site-content access is the **Alumni** area of the full admins' Access page (#247). It is a
    `website` scope row, given to the whole team only, at Can view or Can edit; either level opens
    the Alumni, Partners and FAQ pages.
- **Content** is the team leader's sidebar group of the pages that change the public site:
  Partners, Alumni, then FAQ (boards 72, 76 and 79). Everyone else who reaches them sees them under
  Team. Partners and FAQ follow the Alumni rule: the full admins, and anyone with site-content access. Whoever
  may edit may also publish. The server checks the same rule on every write (`maySiteContent`,
  `lib/content/gate.ts`). See "6. Site content".
- **My account** (non-member) and **My profile** (member and up) open from the user menu only,
  never from the sidebar.
- **Sign out** is in the user menu only. It is never in the sidebar or on the account pages.
- The PRT logo links to the site home. There is no "back to site" button.

## 2. Applications

- The steps are: Received (New), In review, Interview, Decision, and, after an accept, Joined.
- In review starts when the lead first opens the application.

### Interview

- The lead picks the time slots and the length.
- The site sends no email, so the lead must email the applicant. The "I've emailed them" checkbox
  gates the button.
- The applicant picks one slot on My applications.
- The booked time shows on Overview, in the applications list and in the panel, with Add to
  calendar.

### Accept and reject

- Accept and Reject are always confirmed.
- Accept only marks the application Accepted. It does not add the person to the team, and it does
  not touch their other applications: other leads decide those.

### After accept

- The team leader emails the welcome and the NDA.
- The applicant's page only says "The team will contact you about joining. Watch your inbox."
- The lead or the recruitment manager ticks "The signed NDA arrived" and clicks Confirm join, which
  is confirmed. Only then does the person become a member.
  - **Gap:** the dashboard has no recruitment manager; only leads can do this step. Tracked in
    #194.
- Confirm join for someone new asks "Confirm {name} joins {division}?" in neutral words (they,
  their), whatever the application form says (board 58h).
- Confirm join for someone already on the team has no NDA wait: they signed the team's one NDA
  when they joined (see "Divisions per person" below). The panel shows no NDA tick, and its main
  button reads "Add to {division}". It is still confirmed ("Add {name} to {division}?", board
  58h2). The person joins the new division and keeps every division they are in, and no NDA date
  is recorded for them (#229, [0014](../.decisions/0014-several-divisions-one-nda.md)).
- The Members page's joining banner lists only people not on the team yet. A member joins another
  division from the Applications page, or from Add member on the Members page (#231).

### Other rules

- Leads see an applicant's other applications and their progress.
- Withdraw is confirmed. The lead stops seeing the application at once. Its files are deleted 30
  days later; the page does not say so. The person can apply again while the role is open.
- Documents: a CV always, and a motivation letter when the position asks for one. Each file is a
  PDF of at most 2 MB.

## 3. People

### Divisions per person

These rules come from the Owner decisions of 2026-10-11 on #229, recorded in
[0014](../.decisions/0014-several-divisions-one-nda.md).

- One person can be in several divisions at once, as a lead or a member, across departments. Each
  division they are in has its own role. A person is never in the same division twice.
- Picking someone as lead of a division never moves them out of their other divisions.
- There is one NDA for the whole team. A member never signs a second one.
- The viewer's kind reads all their active roles: someone who leads division A and is a member of
  division B is a lead for A and a member for B.
- The Team tree shows each person once, under one division, and draws a dashed blue line from
  every other division they are in, with a blue "also {division}" tag beside them. A legend
  reads "Also in another division · shown once" (board 54e).
- The division a person is drawn under, and the one a page names when it shows only one, is
  their home division: the oldest division they lead, else their oldest membership.
- **Superseded:** rule 7 of [0011](../.decisions/0011-applicant-journey-received-to-joining.md),
  "one person, one division", no longer holds. [0014](../.decisions/0014-several-divisions-one-nda.md)
  replaces it, and also amends 0011's Confirm join rule for someone already on the team.
- **Gap:** My profile and Access still show one division per person (the home division, or the
  oldest one a lead leads). Tracked in #185.

### Handing over a role

These rules come from the Owner decisions of 2026-10-16 on #253 (boards 77i, 77e and 68b4).

- Whoever holds a role hands it over in one step: someone takes over, and the person stepping
  down picks one of two outcomes. Nothing is picked for them, and there is no third option:
  no hand-over leaves them as a member, and none has them leave only their division.
  - **Become an advisor:** the role they handed over ends and one **Advisor** role starts (role
    type `advisor`, migration 0026). A former division lead's Advisor role is in their own
    division, a former department head's in their own department, and a former team leader's
    in no department and no division: they advise the whole team.
  - **Leave the team:** every role and every access ends and they move to Alumni, as Leaves
    the team does.
- Who hands over which role:
  - **Team leader:** only the current team leader, from the Team Leader box in the Team tree's
    edit view (board 77i). The box is locked for everyone else, the operations lead and the IT
    lead included, and the server refuses them.
  - **Department head:** the team leader or full access, with Change head in Edit department
    (board 77e).
  - **Division lead:** the department's head, the team leader or full access, when a new lead
    replaces them in Edit division (board 68b4), or with Promote's "hand over the division".
- **Access after a hand-over** (Owner decision, 2026-10-16): a lead or head who becomes an
  advisor loses every access row they held; they keep only the Advisor role in their own unit.
  A former team leader who becomes an advisor keeps every access row they hold, and the full
  access their role gave them stays with them as an org-wide access row, until the new team
  leader changes it in Access (#247).
- The team leader's own powers (deciding orders by default, giving "Approve orders", handing the
  role over) belong to the role, so they move to the new team leader on save.
- The person who takes over keeps every role they already hold.
- A lead taken off with Remove and no replacement is not a hand-over: Remove keeps its three
  outcomes (see Divisions below).
- **Planned:** a role holder's own request from My profile, which the next level up confirms
  (board 55d), is #262.

### Members page

These rules come from the Owner decisions of 2026-10-11 on #231 (boards 61e to 61h2).

- There is no separate Department page. The Members page shows member data only: it holds no
  structure tools. Divisions and departments are created, edited and closed in the Team tree's
  edit view (see Team structure below, #251). The department head's view is below (#235).
- The table shows each person's divisions as code chips. A division in another department shows
  the department's name instead. Each person's role is their title in this division, or "Division
  Lead".
- The Members lists have no Phone or Discord column (Owner decision, 2026-10-16, #251). Both stay
  on the member panel, where the phone number is blurred until hover (or keyboard focus). The
  panel's Personal section (date of birth, gender) is blurred the same way. The panel has no
  access section: access lives only on the Access page.
- A member is added by searching the team by name or by typing an email.
  - Someone already on the team joins the division at once and keeps their other divisions. They
    sign no second NDA: there is one NDA for the whole team
    ([0014](../.decisions/0014-several-divisions-one-nda.md)).
  - An email not on the team becomes "Waiting for NDA". The person holds no role and no member
    record, so nothing treats them as a member. Only Confirm NDA, by a lead or head, makes them one;
    it records the date and who confirmed it. Someone coming back after leaving waits too.
  - When the person first signs in with that email, their account takes over the record they were
    added with, so they are already who the lead added.
  - The ⋯ menu on a "Waiting for NDA" row also has "Cancel add". It deletes the pending entry and
    nothing else changes, since the person never joined.
- A new member's details are filled by a lead or head (Fill details, or "Fill in their other
  details now" in Add member), or by the person after they sign in with that email. Members never
  have to use the site.
- The site sends no emails. An amber note tells the actor to let the person know, with Fill
  details, Copy email and Open email.
- In Edit details, the role field is only for the editor's own division. Roles in other divisions
  show on the member panel, not in the form.
- The row ⋯ menu has "Remove from {division}" and "Leaves the team".
  - "Remove from {division}" ends only that division's role and its division access; the person
    keeps their other divisions. When it is the person's only division and they hold no seat (the
    team leader, a board seat or a department head), the menu does not offer it, and the server
    refuses it: nobody is on the team with neither a division nor a seat. A seat holder keeps
    their place on the team through their seat, so they can leave their only division (#232).
  - "Leaves the team" ends every role and every access the person has, and moves them to Alumni
    with the years and an optional reason. The account stays. Who may use it:
    - a division lead, only if the person is in no division outside the lead's own;
    - a department head, only if all the person's divisions are in the head's department;
    - the team leader, always (and the operations lead, who already ended whole memberships, #201).
  - A person who also holds a role beyond every division can be moved only by the team leader (or
    the operations lead). That role is the team leader, a department head (also when the head role
    is kept on one of the department's divisions), a board seat, or any other role kept on a
    department or the team. No lead or head reaches it, and the move would end it.
  - Otherwise the item is disabled with a lock and the reason, for example "Also in Safety, so only
    the team leader can do this". The server checks the same rule on every request.
- Confirm NDA, Cancel add, Remove from {division} and Leaves the team each ask "are you sure"
  first.
- A lead cannot rename a division, change its code or change its leads; only the head can. The
  lead's page shows "Leads are changed by the Head of {department}", and the server refuses a
  lead's Promote or lead change.

- The role on the operations lead's member panel is the person's title on the Team page.
  - **Gap:** the title saved on the panel never reaches the public Team page. Tracked in #189.
- Promote changes a division's leads, so it is the department head's (#231). It is confirmed, with
  "lead together" or "hand over the division"; "hand over the division" is a hand-over, so the
  old lead becomes an advisor in the division or leaves the team (#253). Each head of the division's department gets a
  notice under "Needs your attention" on their Overview, naming who now leads the division and how
  (#188). The head who promoted is not told. No email is sent.
  - The head changes a division's leads in Edit division (see Divisions below).
- Move to alumni from the operations lead's member panel is the same "Leaves the team": every role
  and every access ends, after a confirm with the years and an optional reason.
- Leave the team (by the member) is confirmed, with an optional reason. The lead and the
  recruitment manager are told. The person moves to Alumni.
  - The lead of each division the person was in gets a notice under "Needs your attention" on
    their Overview, until they dismiss it (#201).
  - **Gap:** the recruitment manager is not told; the dashboard has none yet. Tracked in #194.
- Someone with no active role left (they left, or were moved to Alumni) signs in as a non-member
  and sees the applicant's pages (#201).
- Delete account: the person types DELETE. It closes the sign-in. The data is kept at least one
  year, then anonymized for statistics. The Privacy Policy must say so (#122). A non-member may
  also withdraw their open applications in the same dialog.
- Alumni entries survive anonymization (#257). Anonymizing a deleted account clears the private
  fields, but keeps the person's alumni entry: their name, years, roles and founder mark stay on
  the Alumni page as part of the team's history. The entry's photo goes.
  - Leave the team and Delete account show an unticked box, "Remove my name from the Alumni
    page". Ticked, the person leaves the Alumni page at once, and anonymization later clears
    every name and photo on their entry. They can also ask for removal later.
- The Alumni page (#257) is built from the roles: each academic year lists who held which role
  in which department or division, closed ones included. 2021–22, 2022–23 and the 2024–25
  advisors come from a one-time import. The dashboard's Alumni page only fixes how someone shows
  (name, founder mark, photo, per-year role text, shown or hidden); a fix never writes a role, a
  division or access. "Add alumni" adds external advisors to the Advisors group and nowhere else;
  the server refuses any other group.
- Access is given only on the Access page. You can give only what you have, and only inside your
  scope.

#### Department head's Members page

These rules come from #235 (boards 69, 69b, 69c and 69m) and the Owner decisions on #231.

- The page lists every open division of the head's department. Its tabs are "All divisions" (where
  it starts) and one per division; there is no Closed tab. On a phone the tabs are one "All
  divisions" select.
- "All divisions" lists everyone in the department's divisions once, leads first. Each row shows
  the person's role and title in their first division of the department. Its ⋯ menu offers
  "Remove from {division}" for each division of the department the person is in, under the rules
  above, and "Leaves the team".
- A division tab is that division's page as its lead sees it, people waiting for their NDA
  included, under a bar with the division's code, name and leads. The bar has no Edit division or
  Close division button.
- Add member starts with a Division select. It lists only the department's open divisions and
  starts on the open division tab, else the first.
- A head acts only on people in their department's divisions: adding, Confirm NDA, Cancel add,
  Confirm join, Edit details, Remove from {division} and Leaves the team. The server refuses the
  rest.
- The page has no "+ New division", "Edit division", "Close division" or "Reopen": the head edits
  their divisions in the Team tree's edit view (below).

#### Team structure

These rules come from the Owner decisions of 2026-10-16 on #251 (boards 77 to 77g, 66t and 66t-b).

- Structure is edited in one place: the Team tree's edit view. The Team tree header shows one
  **Edit** button to the team leader, to full access (#238) and to a department head. A division
  lead and a member get none; a division lead keeps adding and removing members on Members.
- The edit view shows the team leader on top and one column per open department: its box (name,
  head, how many people), then each division's box (name, lead, how many people), every box
  collapsed. **Done** returns to the tree. There is no closed-divisions list.
- The team leader and full access see a pencil on every box, **+ Add division** under each
  department column and **+ Add department** at the end of the row (board 77b).
- A department head sees pencils and **+ Add division** only on their own department's divisions.
  Every other department is dimmed and read-only, and no department has a pencil or Add
  department (board 66t-b). The server refuses a division create, edit or close by a head outside
  their own department, not only the page.
- A division's pencil opens Edit division (below), with **Close division** in its footer. Add
  division opens New division in the department of the column it is under.
- The **Team Leader box** on top opens "Hand over your role" (board 77i, #253) for the team leader
  alone, with a pencil. For everyone else, full access included, it shows a lock and opens
  nothing (see "Handing over a role" above).

#### Departments

- Only the team leader and full access create, edit or close a department. A department head
  never can, not even their own. The server refuses everyone else.
- **New department** (board 77d) needs a name, a code of 2 or 3 letters no other open department
  uses, and exactly one head, picked from the team. The head keeps their divisions. Someone who
  already holds a seat (the team leader, a board seat, another department's head) cannot be
  picked. Divisions are added after, with Add division.
- **Edit department** (board 77e) shows the name, the code, the head, and the divisions as rows
  that open to list their people, lead first, read-only. Save changes stores a new name or code,
  after an "are you sure" that lists each change.
- **Change head** (board 77e, #253), under the head in Edit department, picks the new head from
  the team. As in New department, someone who already holds a seat cannot be picked, and the
  new head keeps their divisions. The head they replace gets "What happens to {name}?":
  Become an advisor (in this department) or Leave the team, with neither picked at first. The
  change is saved with Save changes, after the same "are you sure".
- **Close department** (board 77f), from Edit department's footer:
  - Each open division gets a choice: move it to another open department, or close it. A division
    with anyone in it (people waiting for their NDA included) can only move.
  - The head gets a choice too, in the drawer's "Head" block, with neither option picked at first
    (Owner decision, 2026-10-16). Nobody gets a role automatically.
    - **Become an advisor:** the head role ends and one Advisor role starts, in no department and
      no division, since the department closes. Every access row they hold is removed (Owner
      decision, 2026-10-16).
    - **Leave the team:** every role they hold ends and their access goes, as Leaves the team
      does, so they appear on Alumni.
  - Close department stays disabled until every division and the head have a choice. The server
    refuses a close that picks nothing for the head of a department that has one.
  - A division that moves takes its people, its leads and its open positions with it. Every role
    and access row that names the old department for that division follows it. A seat row kept on
    the division (a head's, the team leader's) does not move.
  - A division that closes closes as Close division closes it: its open positions close and its
    division access goes.
  - The department closes (`closed_at` is set) and its department access goes.
  - It asks "are you sure" first, listing what happens to each division and to the head. A closed
    department cannot be reopened.

#### Divisions

These rules come from the Owner decisions of 2026-10-11 on #232 (boards 68b to 68c and 69d) and
of 2026-10-16 on #251.

- Only the head of a division's department, the team leader or full access creates, edits or
  closes it. A division lead never can, not even for their own division. The server refuses
  everyone else.
- **No reopen.** A closed division never opens again: there is no Reopen control, no Closed tab
  and no save that clears a division's `closed_at` (board 68e is dropped). Closed divisions stay
  only as names in history; a team that needs one back creates a new division.
- A division has a name and a code. Divisions have no description.
  - The code is 2 or 3 letters, kept in capitals. No two open divisions share a code; a closed
    division's code is free again.
  - Position codes are built from the division's code when they are read, so changing a code
    changes the code of every position in that division. The save asks "are you sure" and names
    the old and new code.
- Edit division is one drawer with name, code, leads and members.
- Leads are picked from the whole team and keep their other divisions. Anyone on the team can be
  picked, the team leader, a board seat and a department head included (Owner decision,
  2026-10-11, on #232). They keep that role and lead the division beside it: the Members page
  lists them in the division, and the Team tree still draws them once, at their seat.
  - A seat stays a seat through every division write. Some seat rows are kept on a division (a
    head's row, for example). Leaving a division, "Remove from {division}", a promote on a save,
    and a lead who stays as a member each end or change only lead and member roles. They never end
    or change a seat row. A seat row kept on a division is not a role in it: the person is in that
    division only when they also hold a lead or member role there.
- An open division always has at least one lead. A create or an edit that would leave it with
  none is refused.
- A new lead can replace an old one ("{new} replaces", default "Nobody, add as an extra lead").
  Each new lead replaces at most one old lead.
- A **replaced** lead hands the division over (#253, board 68b4): "What happens to {name}?" offers
  only **Become an advisor** (the Advisor role in this division; all their access ends) and
  **Leave the team**, with neither picked at first. Save changes waits until one is picked.
- A lead taken off with **Remove** and no replacement is not a hand-over, and gets one of three
  outcomes:
  - **Stays as a member** (the default): they keep the division and lose the lead role.
  - **Leaves {division}**: their role and division access there end; they keep their other
    divisions, and any seat. Not offered when it is their only division and they hold no seat.
  - **Leaves the team**: every role and every access ends and they move to Alumni, as "Leaves the
    team" on the Members page.
- Leaving the team, for a replaced or a removed lead, follows the Members page's permission rule;
  otherwise it is disabled with a lock and the reason.
- Name, code and lead changes are saved together with "Save changes", after an "are you sure"
  that lists each change. Members of an open division change one at a time, as on the Members
  page: Add member (from the whole team, or an email that then waits for Confirm NDA), Confirm
  NDA, Cancel add, "Remove from {division}" and "Leaves the team", each behind its own confirm.
- New division needs a name, a code and at least one lead; "Create division" stays disabled until
  then, and the server refuses a division without them. Its members are picked in the same
  drawer, from the team or by email, and join when it is created. Everyone keeps their other
  divisions.
- A division cannot close while anyone is in it, people waiting for their NDA included. The
  dialog then says how many people are left and offers Edit division. Closing an empty division
  asks "are you sure", then closes its open positions and removes every access given in it.
- The site sends no emails here either: the drawer shows the amber note for anyone added by
  email.

### Access

These rules come from #213 (boards 60, 60b, 60c and 60m).

- There are two levels: **Can view** and **Can edit**. Can view lets a person see an area. Can
  edit also lets them change it. There is no third level.
- There are four areas, each scoped to the lead's division: **Positions**, **Applications**,
  **Members** and **Orders**.
  - Applications at Can edit moves applications between steps and accepts or rejects them.
  - Orders at either level shows every order in the team (#233). Orders at Can edit also lets
    them request, edit and cancel the orders of that division. Orders at Can view edits nothing.
    A person with no Orders access does not see the Orders page.
- A person holds each area at one level or not at all. In both drawers each area has a tick; a
  ticked area takes its own level, and an unticked area means no access.
- Delegation limit: a lead gives only an area they hold, and only up to their own level in it.
  They cannot change or remove access held above their level, or another lead's access. The
  server checks every change, not only the drawer.
- The table has one row per person, with a chip per area and its level, and "Given by".
  Clicking a row opens Edit access: the person and the division are locked, and Save writes
  the adds, level changes and removals in one go. While a side panel is open on a screen 1280px
  or wider, "Given by" is hidden, so names and the full "Can edit" chips keep their room (#244).
- "Remove all access" removes every area for that person, after a confirm.
- "Your access" is one line: "YOUR ACCESS · {division}", then a chip per area with its level.
- Every change is written to the activity log.
- On a phone the table is a card per person with the same chips, and a tap opens the same
  drawer.
- The other leads of the division are listed first, with "Whole division · Can edit", "With the
  role" and a lock. Their access comes with the role and cannot be changed or removed here. A
  lead's own page shows their co-leads, never the lead themselves (Owner decision, #230).

#### Department head

These rules come from #230 (boards 65, 65b, 65c and 65m).

- A head's role holds every area at Can edit across their whole department: "YOUR ACCESS ·
  {department} Department, all divisions".
- The table lists the division leads of the department first, with "Whole division · Can edit",
  "With the role" and a lock (Owner decision, #230), then everyone the department shared access
  with. Division tabs narrow the table to the people of one division.
- Give access has a "Where" field: the whole department, or one division (Owner decision, #230).
  A grant for the whole department is a `scopes` row with only `dept_id` set, and its chip carries
  a "Whole department" tag. A person holds each area at one level per place.
- The delegation limit is the lead's: a head gives only what they hold, at no higher level, and
  only inside their department. A lead's role access cannot be removed. The server checks every
  change.
- Edit access (board 65c) locks the person ("can't be changed") and keeps "Where" editable. It
  opens on the first place the person holds access in; changing "Where" shows their areas in
  that place. The foot has "Remove all access" and "Save". "Remove all access" removes every
  area in every place, after a confirm.

#### Full access

These rules come from #238 and #247 (boards 71 and 71b).

- Full access holds every area at Can edit across the whole team, Alumni included: "YOUR ACCESS ·
  Full access, whole team", with one "Every area · Can edit" chip, and "Approve orders" for the
  team leader.
- Above the table: Everyone, Full access and Approve orders tabs, each with its count, and an "All
  departments" select. The other full-access seats show first ("Full access · Whole team", "With
  the role", locked), then the heads and division leads with their role's access, locked.
- Give access picks a person from the whole team and a Where: the whole team (a `team` scope row
  in no unit, which covers every department and any added later), one department, or one division.
  The areas are Positions, Applications, Members, Alumni and Orders, each at Can view or Can edit.
  Alumni is given to the whole team only.
- **Approve orders** is a checkbox in Give access that only the team leader sees; the server refuses
  it from anyone else. The operations lead and the IT lead give every other access. The Activity
  log is never given: it stays the IT lead's.
- The delegation limit still holds: no area above the viewer's own level, and no lead's role
  access changes here.

## 4. Orders

These rules come from the Owner decisions of 2026-10-11 on #233 (boards 61 to 61d, 61m, 67, 67b
and 67m).

- The statuses are Waiting, Approved, Ordered, Changes requested and Rejected.
- **Ordered** follows Approved and nothing else (#247, board 70c). An approved order shows "Approved
  by you on {date}" (or the approver's name) and a "Mark as ordered" button. The people who decide
  orders (the team leader and the holders of "Approve orders") mark an order as ordered, and only
  an approved one; the server refuses it from anyone else and from any other status. Ordered is
  final: nobody edits, decides or cancels it. Its pill is grey.
- **Who sees.** Anyone with any Orders access sees every order in the team, in every
  department. A person with no Orders access does not see the page.
  - **Gap:** the sidebar still lists Orders for every division lead, whether or not they hold
    Orders access; a lead with no Orders access gets "not found" on the page. Tracked in #160.
- **Who edits.** A division lead edits the orders of their own division, from any requester in
  it. A department head edits the orders of their whole department. Full access edits every
  order in the team (#238). A grant of Orders at Can
  edit opens the orders of the division (or the whole department) it was given in. Nobody edits
  outside their scope: those rows show a lock and open read-only. The server checks the scope on
  every write, not only the page.
- Each order stores its own division, set when it is made. A lead orders for their division; a
  head picks one of their department's divisions in New order. Older orders took their
  requester's division in migration 0017.
- Editing a request, or "Edit and send again" on Changes requested, sends it back to Waiting.
  A request can be cancelled only while it is waiting.
- **Who decides.** By default only the team leader approves, rejects or asks for changes. The
  operations lead and the IT lead do not, although they have every other access. The team leader
  can give **"Approve orders"** to any number of people, from their Access page; there is no
  limit on how many hold it. Only the team leader gives or removes it. The server refuses a
  decision from anyone else, and a decision on a request that is not waiting.
- **Deciding on the page** (#247, boards 70 to 70e). A waiting order opened by someone who decides
  shows Reject, Ask for changes and Approve; Edit moves to the panel's head. While a panel is open
  the Department column is hidden. Ask for changes opens a "What should change" note, which is
  required; the requester sees it and can edit and send the request again. Reject opens a "Why
  (optional)" note; the requester sees the reason, and a rejected request can never be edited or
  sent again: they make a new one.
- Approve, reject, ask for changes, mark as ordered and cancel each ask "are you sure" first.
- **The table.** No tabs. The Department · Division and Status column headers each have a filter.
  The department filter is a list of departments with checkboxes, each with its divisions nested;
  ticking a department ticks all its divisions. Clear and Apply sit at the foot. Departments are
  in the team's order, as on the Team tree and board 67b; divisions are by name (#244).
- 12 orders per page, newest first. "Newest first" sits on the left of the pager row, and the
  pager is centred ("‹ 1 2 3 … 6 ›"), with no total count.
- While a side panel is open (New order, an order, Edit order), the Department column is hidden.
  On screens from 1280px to 1439px wide, Requested by is hidden too, so no cell is squeezed (#244).
- On a phone, Department and Status are filter chips, each card has a "{department} · {division}"
  line that wraps rather than cutting the division short, locked cards show a lock, and there is
  a pager.
- The site sends no email: where someone must be told, the page tells the actor to contact them.

## 5. Data and testing

- Previews, and `next dev` without a database, run on dummy data. They offer the "Sign in as test
  developer" switch, with six people: team leader, operations lead, department head, division
  lead, member and non-member. The operations lead there sits in the operations lead's seat, so
  they have full access and do not decide orders; the team leader decides orders and gives
  "Approve orders" (#247), and sees boards 72 to 73c (#252).
  Production never does. The sign-in link takes `applications=none` (no applications yet) or
  `applications=withdrawn` (only withdrawn ones) to start the viewer from those states.
- On a phone, popups become bottom sheets, side panels become full pages with a back arrow, and
  tables become stacked cards.

## 6. Site content

These rules come from #256 (boards 76 and 76b). Partners is the first content editor; Outreach,
Projects and FAQ (#254, #255, #258) reuse its foundation in `lib/content/`.

- Every content item keeps the version the public site shows and, beside it, an optional working
  draft. "Save draft" never reaches the public site; "Publish" makes the draft the public version.
  A new item saved as a draft is not on the site at all.
- The list shows Published or Draft. The panel says "Draft changes" for a published item with a
  draft.
- Partners are grouped Main, then Media, each with its count. Dragging a row, or Move up and Move
  down in its menu, sets its place within its tier; /partners and the home logo strip follow that
  order.
- While a side panel is open on a screen 1280px or wider, the website column and the drag grip
  are hidden and the logo box narrows, so names and one lines keep their room (#244). A row still
  drags by itself, and its menu still moves it.
- The panel enforces the text limits of `PARTNER_TEXT_LIMITS` (one line 80, about 220, support
  160, counted as characters, so "ò" is one) with a live counter, and the server refuses a text
  over its limit.
- A logo is an 8-bit PNG of at most 1 MB. It is measured on upload: one too dark for the page is
  saved with the dark flag, and the panel and the public pages draw it white.
- Remove asks "are you sure" first. It removes the partner and its draft at once.
- Previews never touch a database: a test developer's partner changes stay in a cookie in their
  own browser until they sign out, and a logo they upload is not kept. The public pages there show
  the partners as they were before the switch.

### FAQ (#258, boards 79 and 79b)

- The FAQ page lists the questions at the bottom of /apply in site order, under the columns
  Question (with the answer's first paragraph under it), Updated and Status. Updated says "Today"
  for a version written that day in Turin, else the day ("12 Sep"). Status says Published, Draft
  or Draft changes.
- Dragging a row, or Move up and Move down in its menu, sets its place. The order is saved at
  once, and /apply follows it for every published question; a draft takes its place there when
  it is published.
- While a side panel is open on a screen 1280px or wider, the Updated column is hidden.
- The edit panel shows the status and, for a question on /apply, its place there ("3 of 11 on the
  Apply page"). The question is at most 120 characters, with a live counter. The answer is one box
  per paragraph: a box drags by its grip (or moves with the arrow keys on it), × removes it, and
  Add paragraph adds one. A blank box is left out; an answer with no paragraph is refused. The
  server refuses the same, and a paragraph over 1,500 characters.
- "On the Apply page" shows the open question as the /apply accordion draws it opened, as it is
  being typed.
- Remove asks "are you sure" first, and removes the question and its draft at once.
- Every write renders /apply again (it is prerendered whole, #163).
- Previews never touch a database: a test developer's question changes stay in their own cookie
  until they sign out, seen from the dummy team's moment, so a change reads "Today". /apply there
  shows the questions as they were before the switch.
