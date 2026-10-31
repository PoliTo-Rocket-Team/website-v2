# Dashboard rules

What each person sees in the dashboard, and the rules behind each action. Read this before any
dashboard work. The rules come from Huey's rulings on #141, #168, #169, #170, #171, #172 and #179.

Each rule is stated as Huey ruled it. Where the merged code does not follow a rule yet, a
**Gap** line under it names the open issue that tracks the fix. A rule whose feature is not
built yet is marked **Planned**.

## 1. Who sees what

The six people:

- **Non-member**: signed in, not on the team (an applicant).
- **Alumni**: signed in, every role ended, and on the Alumni record (#317). An alumnus holds no
  access: leaving ends every role and grant, and any access row left over gives nothing. To get
  access again they are added back with a role.
- **Member**: on the team.
- **Division lead**: leads one or more divisions.
- **Department head**: heads a department and all its divisions.
- **Full access**: the team leader, the operations lead, the IT lead, the Project Manager, the
  Chief Engineer and the Logistics lead (#885). They see and act on the whole team (see "Full
  access" below).

An **advisor** (#253) is someone who handed over a role and stayed in the team (see "Handing
over a role" below). The Advisor role leads nothing and heads nothing: it is never counted as a
lead or a head, so an advisor reaches a member's pages, plus whatever their access rows give
them. A former team leader who became an advisor keeps full access through an access row.

An admin column comes later. **Planned**, no issue yet.

| Sidebar item or page | Non-member | Alumni | Member | Division lead | Department head | Full access |
|---|---|---|---|---|---|---|
| My applications | Yes, only while one is shown | Yes, only while one is shown | Yes, only while one is shown | Yes, only while one is shown | Yes, only while one is shown | Yes, only while one is shown |
| Overview | Yes | Yes | Yes | Yes | Yes | Yes |
| My alumni | No | Yes | No | No | No | No |
| Team tree | No | No | Yes | Yes | Yes | Yes |
| Positions | No | No | No | Own divisions | All divisions in the department, under division tabs | All, plus the site-wide recruitment switch; the team leader also has a division select |
| Applications | No | No | No | Own divisions | All divisions in the department, under division tabs | All; the team leader has department and division selects |
| Members | No | No | No | Their divisions | Their divisions | The whole team; the team leader's has a List and a Table view |
| Projects | No | No | Only with Content | Only with Content | Only with Content | Yes; the team leader's sidebar shows it first under Content |
| Partners | No | No | Only with Content | Only with Content | Only with Content | Yes; the team leader's sidebar shows it under Content |
| Alumni | No | No | Only with Content | Only with Content | Only with Content | Yes; the team leader's sidebar shows it under Content |
| FAQ | No | No | Only with Content | Only with Content | Only with Content | Yes; the team leader's sidebar shows it under Content |
| Access | No | No | No | Their divisions | Their department, under division tabs | The whole team, under department tabs |
| Orders | No | No | Only with "Approve orders": every order in the team, under Team; decides, edits nothing | Every order in the team; edits their divisions' | Every order in the team; edits their department's | Every order in the team; edits every order |
| Activity log | No | No | No | No | No | The IT lead only |
| My account | User menu only | User menu only | No | No | No | No |
| My profile | No | No | User menu only | User menu only | User menu only | User menu only |
| Sign out | User menu only | User menu only | User menu only | User menu only | User menu only | User menu only |

- **An application is shown** while it is being decided (New or Interview, or a status added under either),
  and until one month after its latest decision: accept, reject, another team taking the person,
  join, or withdraw. After an accept, the join is the latest decision. Then it leaves the Overview
  and My applications, for everyone; the data stays (Owner decision, #317). A decision from before
  its time was stored (`rejected_at`, migration 0030) counts as past the month.
- **My applications** shows for everyone, but only while one of their applications is shown.
  With none shown, its address opens the Overview.
- **Every viewer lands on the Overview** (#317). A non-member with nothing shown sees their name,
  their sign-in address and "No applications right now" (board 50f). Before #317 they landed on
  the My applications empty state (#179).
- **Every seat may have several active holders** (Owner decision on epic
  [#861](https://github.com/PoliTo-Rocket-Team/website-v2/issues/861), 2026-10-30): the team
  leader seat, each full-access seat, each department's head seat and every other team-level
  seat. Each holder, a co-holder when there are several, has the seat's full rights, exactly as a
  sole holder has them; there is no per-holder tier. The database refuses no second active holder:
  migration 0077 dropped the one-holder indexes migration 0062 had added (#667), and changed no
  row. A hand-over or Change holder ends the holder's own row by choice, not because the database
  refuses a second one.
- **What goes to a seat goes to every holder of it** (epic #861,
  [#870](https://github.com/PoliTo-Rocket-Team/website-v2/issues/870)). Each rule reads the
  viewer's own seat, never "the" holder, so with several holders each one sees and may act:
  - every team leader decides orders, sees the orders waiting for a decision, and gives and
    removes "Approve orders"; no team leader is given "Approve orders", since each decides by the
    seat, but a grant one kept from a seat held before becoming team leader can still be removed,
    through Edit access or Remove all access (see "4. Orders");
  - every holder of an alias approver seat (the team leader, the operations lead, the IT lead)
    sees each waiting PRT email request, team address request, routing item and removal, the
    personal PRT email removals of members who left included, and
    either holder may answer it or mark it done;
  - a head's hand-over request goes to every team leader, and a lead's to every head of the
    lead's department; the sender is never one of them, and either approver may answer;
  - every other "Needs your attention" row and count meant for a seat, such as the team leader's
    count of acceptance emails to send, is read off the viewer's own seat, so each holder gets it;
  - a routing item for a team address that moves with a seat names a current holder of it: the
    member the item names while they still hold the seat, else the newest holder. While the
    address's holder still holds the seat, beside any co-holder, nothing moves.
- **Full access** comes from the role alone, with no scope row (Owner decisions, 2026-10-11,
  #238; Owner decision, 2026-10-21, #485; Owner decision, 2026-10-31,
  [#885](https://github.com/PoliTo-Rocket-Team/website-v2/issues/885)). Six seats hold it:
  - the **team leader**: the role of type `president`;
  - the **operations lead** and the **IT lead**: each seat's role carries a full-access flag
    (`roles.full_access`, migration 0018), set once in the data. These seats are never read from
    a department or division code, or from a title, because codes change.
  - the **Project Manager** and the **Chief Engineer** (#485): each board seat's role carries the
    same flag (migration 0047, which marked the active board roles titled exactly "Project
    Manager" and "Chief Engineer" once). The code reads only the flag. Access follows the role:
    ending the role ends it. A hand-over moves the flag to the successor's role, and Add another
    holder (#868, under "Team structure") copies it onto the new holder's role; no other flow
    sets it.
  - the **Logistics lead** (#885): every active lead of the open Logistics division (Operations
    department), the division the recruitment manager rule finds (see "Recruitment"). This seat
    is the one read from its division and not from a flag: it has no `roles.full_access` value,
    and no row is ever flagged as it, so team address "Moves with" and the flag a hand-over moves
    never offer or write it. The access follows the lead role: it starts when someone becomes a
    Logistics lead and ends when the role ends (hand-over, leaving, removal), with no scope row
    written or removed. Every co-holder holds it. While Logistics is closed or has no lead, nobody
    holds it. A member of Logistics, or someone whose only Logistics link is an area grant, does
    not hold it. The Access page lists it as "Logistics Lead".
  - Someone in two seats shows as the higher one: the team leader, the IT lead, the operations
    lead, the Project Manager, the Chief Engineer, then the Logistics lead.
  - Full access reaches every page in the table, in every department and every division. On
    Access and Orders it sees and acts on the whole team, and it can give any access to anyone.
  - An `admin` or `org` scope row still gives full access, as before.
  - **Exception 1, deciding orders:** by default only the team leader approves, rejects or asks
    for changes. The other full-access seats decide only with "Approve orders" (see
    "4. Orders").
  - **Exception 2, the Activity log:** only the IT lead reaches it, and their sidebar lists it at
    the end of TEAM (board 101,
    [#642](https://github.com/PoliTo-Rocket-Team/website-v2/issues/642)). It lists every stored
    change of the last 12 months, newest first, 12 to a page: When, Who, Change and Area, with
    search, All / View as only, Area, Person and date range filters. A change made during View as
    shows "<seat title> as <person>" with "by <acting person>" under it. View as starts and stops
    are their own rows, and a start with no stop whose session has expired shows as ended by
    timeout at that expiry, worked out when the page is read.
  - **Exception 3, the acceptance email:** only the team leader sets an application to
    "Accepted · email sent", by Mark email sent or by the Status picker, because the team leader
    sends the acceptance email with the NDA. Everyone else sees that status locked as team leader
    only, gets no Mark email sent on "Accepted · email to be sent", and sees a note on an accepted
    application not to email the applicant (board 97e, ADR 0011 rule 6,
    [#751](https://github.com/PoliTo-Rocket-Team/website-v2/issues/751)). "Rejected · email sent"
    stays open to anyone who can move the application.
- **The team leader's own pages** (boards 72 to 73c, #252). The team leader has full access like
  the operations lead and the IT lead, but some of their pages differ. The operations lead and the
  IT lead keep boards 40 and 46.
  - **Sidebar:** Overview and Team tree, then RECRUITMENT (Positions, Applications), TEAM
    (Members, Access, Orders) and CONTENT. CONTENT holds the content pages that exist; today that
    is Projects, Outreach, Partners, Alumni, FAQ, then Team page. Each content page adds its own row there.
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
    Every division's people waiting for their NDA are listed first, with Confirm NDA, Cancel add
    and Fill details, and every division's "{name} is joining" banners show above the list, as a
    head or a lead sees their own units' (#584, Owner decision, 2026-10-22). The selects narrow
    both.
  - **Members, Table view (boards 73b, 73c):** every member field: name, divisions, role, PRT
    email, phone, Discord, PoliTo ID, program, level, from, date of birth, gender and NDA. The
    name column stays pinned; the table fills the screen and scrolls both ways, with no pages.
    Phone, date of birth and gender stay blurred until hover. Divisions, Role, Program, Level,
    From, Gender and NDA each have a filter: a search, a tick and a count per value, Clear, and
    "N selected". Within a column any ticked value matches; across columns all must.
  - **Positions and Applications:** as the operations lead's, with "All departments" and "All
    divisions" selects, as on the department head's boards 63 and 64. New position lists every
    division of the team.
- **Overview** is for everyone. A non-member's lists their shown applications (boards 50e and
  50e-m, #211) or says there are none (board 50f); a withdrawn application is never a row there,
  and stays under Past on My applications (Owner decision, #227). Neither a non-member's nor an
  alumnus's Overview lists open positions (Owner decision, #317).
- **One Overview for the whole team** (Owner decision, 2026-10-24, #593, in place of #480's
  separate member Overview). Every team seat, the plain member, a member with grants, a division
  lead, a department head, the operations lead and the team leader, gets the same Overview. Only
  the figures, rows and panels its scope reads, and the actions it allows, differ:
  - **Personal panels (board 52), for every seat:** the profile header with Edit profile, "Your
    page on the site", and a roster for each division they are in. A seat whose roles name no
    division (a head, the team leader) has no roster.
  - **"Your page on the site"** lists four steps: name and division, email, photo and LinkedIn.
    Name and division is done from the seat the viewer holds, and names who sets it: a member's
    and a division lead's division lead; the team leader for a department head and a team-level
    seat; for the team leader, the previous team leader who handed the role over. Once all four
    steps are done the panel is hidden, and the rosters stand on their own. It shows again, with
    its "N of 4 done" count, as soon as a step becomes undone, for example when the photo is
    removed (Owner decision, 2026-10-24, #641).
  - **The scope's board (boards 40, 56, 62, 72)** under the profile: the figures, "Needs your
    attention" and the panels of the seat's scope. A member gets board 56 with only the areas they
    are granted, at the grant's scope, so a plain member gets no figure. Their own notices and the
    rows for whoever decides orders (#592) show whatever the seat.
  - **"Your access"** under the personal panels lists each grant the viewer holds, whatever their
    seat: each area grant, counted in the units the grant names only, then "Approve orders", then
    Content. A grant with no figure card still shows here. A plain member with no grant sees the
    access hint in its place; a seat that reads its areas by role and holds no grant sees neither.
  - **The Members figure names the scope it counts:** "My division" for the viewer's own division,
    "Division" for another one, "Department" for a whole department, "Team" for the whole team,
    and "Divisions" for any other set.
- **An alumnus's Overview** (board 56, #317) reads "Former member · {last unit} · {years}" from
  their ended roles, then a card that says whether the Alumni page lists them, with "Open My
  alumni". Their shown applications follow it.
- **My alumni** (board 56b, #317): "Show me on the Alumni page" is the person's own request, the
  same one the leave-time box "Remove my name from the Alumni page" records (#257); an editor's
  Hidden on board 78 is not theirs to undo. The photo is the one the Alumni page shows, checked as
  on board 78b. The role history lists each academic year from the team's roles, read-only: a
  wrong entry is the team leader's to fix on the Alumni page.
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
- **Members** and **Access** are for division leads and up, scoped to their divisions. A lead of
  more than one division picks which one Members shows (#231). **Orders** shows every order in
  the team; see "4. Orders".
  - A lead of more than one division sees one Access list covering all their divisions, with an
    "All divisions" select that filters it to one, as the team leader's Access page filters
    departments (board 71). There is no picker and there are no tabs. A lead of one division sees
    no select (Owner decision, #185).
  - Access a lead gives goes in the division of the person they edit, only in a division they
    lead, and only up to what they hold there. Members edits reach people in any division the
    lead leads, never one outside them (#185).
  - A lead's Access page covers only the divisions they lead by role. A grant the lead holds in a
    division they do not lead gives them only what it gives a member there, such as that area's
    page. It adds no Access page there, and the lead cannot give or remove access there (Owner
    decision, #478; #488).
  - A department head's Members page holds every division of their department (#235).
- **Alumni** is where the team checks the public site's alumni content. It is site content, so
  it follows the site-content rule: the full admins (the operations lead, the team leader and the
  IT lead) and anyone with a **Content** grant. A division lead or department head gets nothing
  from their role here (Owner decision, #234). The sidebar item, the page and every Alumni write
  read one rule, and the page answers "not found" to everyone else.
  - Owner decision (2026-10-22, #589), in place of the 2026-10-21 rule of #504 that kept Alumni
    a separate grant: there is no Alumni grant and no Alumni area on the Access page. A Content
    grant opens the Alumni page and its actions with the other content editors. The old Alumni
    rows (a `website` scope row on `all`, at either level) opened nothing; each holder of one was
    given a Content grant, so nobody lost access (`drizzle/0058`), and the old rows were then
    deleted (#637, `drizzle/0074`).
- **Content** is the team leader's sidebar group of the pages that change the public site:
  Projects, Outreach, Partners, Alumni, FAQ, then Team page (boards 72, 74, 75, 76, 79 and 80).
  All six follow the site-content rule: the full admins, and anyone with a **Content** grant.
  Whoever may edit may also publish. The server checks the same rule on every write
  (`maySiteContent`, `lib/content/gate.ts`). See "6. Site content".
  - The Content grant is its own Access area (Owner decision, 2026-10-21, #504). It is a
    `website` scope row on `content`, given to the whole team only and at Can edit only; a
    `website` row at Can view is no grant (#589). It opens those six editors and their actions
    and nothing else, and no other grant opens them. Only a viewer with full access or a Content
    grant gives, changes or removes it. Anyone holding it sees the Content group with those six
    pages, and a "Content" line under "Your access" on their Overview (#593).
- **My account** (non-member and alumni) and **My profile** (member and up) open from the user menu only,
  never from the sidebar.
- **Sign out** is in the user menu only. It is never in the sidebar or on the account pages.
- The PRT logo links to the site home. There is no "back to site" button.

## 2. Applications

These rules come from the Owner decisions of 2026-10-25 on epic #588 and the rulings on its
grilling session #745, recorded in the 2026-10-25 status-list amendment of
[0011](../.decisions/0011-applicant-journey-received-to-joining.md). The code follows them.

### Application status

- Every application has one status from one list. There are no separate stages and statuses
  ([Owner decision, 2026-10-25](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399491157)).
  The ten built-in statuses, in order:
  1. New
  2. Interview (booked or being arranged)
  3. Accepted · email to be sent
  4. Accepted · email sent (the NDA email went out)
  5. NDA received
  6. Joined (Confirm join)
  7. Rejected · email to be sent
  8. Rejected · email sent
  9. Accepted for another position
  10. Withdrawn (the applicant backed out)
- Approvers can add their own statuses. Each added status sits under one built-in status, its
  parent, chosen when it is created (for example "Second interview" under Interview). It behaves
  like its parent: the applicant sees the parent's public step, and the parent's buttons apply.
  Built-in statuses can be renamed and recoloured but never deleted. An added status can be
  deleted only while no application uses it
  ([Owner decision, 2026-10-25](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399501184)).
- There is no "In review" status. Opening an application never changes its status, and existing
  In review applications read as New
  ([ruling R1.2](https://github.com/PoliTo-Rocket-Team/website-v2/issues/745#issuecomment-6399753082)).

### Action buttons and hand pick

- The drawer's bottom bar shows only the buttons for the current status. Each asks for a confirm
  and sets the next built-in status
  ([Owner decision, 2026-10-25](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399628523)):

  | Status | Buttons |
  |---|---|
  | New | Move to interview → Interview; Reject → Rejected · email to be sent |
  | Interview | Change times; Accept → Accepted · email to be sent; Reject → Rejected · email to be sent |
  | Accepted · email to be sent | Mark email sent (team leader only) → Accepted · email sent; Withdraw acceptance → New |
  | Accepted · email sent | NDA received → NDA received |
  | NDA received | Confirm join → Joined, and the person's other open applications → Accepted for another position |
  | Rejected · email to be sent | Mark email sent → Rejected · email sent |
  | Joined, Withdrawn, Rejected · email sent, Accepted for another position | No buttons |

  An added status uses its parent's buttons. The buttons only ever set built-in statuses.
- Every status, built-in or added, can also be picked by hand in the Status picker. The buttons
  are shortcuts for the next step. A hand pick of a built-in status has exactly the same effect as
  the button that sets it, with the same confirm: picking Joined runs Confirm join, and picking
  Interview starts the interview step. Both go through one server move
  ([ruling R1.1](https://github.com/PoliTo-Rocket-Team/website-v2/issues/745#issuecomment-6399752172)).
  A hand pick of an added status sets the status and records the day its parent keeps when the
  application has none yet: the acceptance day, the NDA day, the join day, or the day it ended
  without a place. So the applicant sees the parent's public step for the usual month, and Confirm
  join works under NDA received. It adds no one to the team, offers no times and is not a
  withdrawal.
- A hand pick is a draft until saved: the picker has Save and Cancel, and the action buttons are
  locked while the change is unsaved, with a hint to save or cancel it first
  ([Owner decision, 2026-10-25](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399407814),
  points 2 and 3; boards 97 to 97e).

### Who sets which status

- Anyone who can move an application can set its status and can manage the status list: add,
  rename, recolour, and delete unused added statuses
  ([Owner decision, 2026-10-25](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399538440)).
- Only the team leader sets "Accepted · email sent", by Mark email sent or by hand pick: the team
  leader sends the acceptance email with the NDA. Anyone who can move the application sets
  "Rejected · email sent".
- Everyone else sees a note on an accepted application: do not email the applicant; the
  acceptance email is the team leader's job. In their Status picker, "Accepted · email sent" shows
  as team leader only (board 97e).

### What the applicant sees

- The applicant never sees the team's statuses, only public steps
  ([Owner decision, 2026-10-25](https://github.com/PoliTo-Rocket-Team/website-v2/issues/588#issuecomment-6399713897)):
  Received (just applied); In review (every internal status in between); Interview (only while
  they need to pick or see an interview time); the outcome, Accepted (then the NDA step) only from
  "Accepted · email sent", and Not selected only from "Rejected · email sent" and for "Accepted for
  another position"; and Withdrawn. Until the email status is "sent", they still see In review.
- My applications keeps the layout of boards 50 to 50d.

### Interview

- The lead picks the time slots and the length.
- The site sends no email, so the lead must email the applicant. The "I've emailed them" checkbox
  gates the button.
- The applicant picks one slot on My applications.
- The booked time shows on Overview, in the applications list and in the panel, with Add to
  calendar.

### Accept and reject

- Accept and Reject are always confirmed.
- Accept only sets "Accepted · email to be sent". It does not add the person to the team, and it
  does not touch their other applications: other leads decide those until Confirm join.

### After accept

- The team leader emails the welcome and the NDA, then sets "Accepted · email sent".
- From "Accepted · email sent", the applicant's page only says "Check your email."
  ([decision on #790](https://github.com/PoliTo-Rocket-Team/website-v2/issues/790#issuecomment-6425142072)).
- Once the signed NDA is back, "NDA received" is set, then Confirm join, which is confirmed. Only
  then does the person become a member. Confirm join sets the person's other open applications
  to "Accepted for another position".
- The recruitment manager is the lead of the Logistics division, in the Operations department
  ([Owner decision, 2026-10-22](https://github.com/PoliTo-Rocket-Team/website-v2/issues/194#issuecomment-6341780484)).
  They see every division's applications and may make every move a lead may make on them,
  team-wide: "NDA received" and Confirm join included
  ([Owner decision, 2026-10-25](https://github.com/PoliTo-Rocket-Team/website-v2/issues/194#issuecomment-6396490285)).
  While the Logistics division is closed, nobody is the recruitment manager (#194).
  - The recruitment manager may open and close recruitment: their Positions page shows the
    site-wide recruitment switch, with the same warning step full access sees, and the server
    accepts it from them (Owner decision, 2026-10-31, #875).
  - Since [#885](https://github.com/PoliTo-Rocket-Team/website-v2/issues/885) (Owner decision,
    2026-10-31) the same lead seat is a full-access seat, the Logistics lead (see "Full access"
    above). Every page, Positions and Members included, covers the whole team for them, and
    they hold every other full-access right. This replaces the narrower rule of #194 and #875,
    where the role gained only team-wide Applications moves and the recruitment switch. Deciding
    orders and the Activity log stay apart, as for the other full-access seats.
- Confirm join, and setting "NDA received", is the last step of the application, so the
  Applications area decides it wherever it appears (#584, Owner decision, 2026-10-22). On the
  Applications page and on the Members page's "{name} is joining" banner it shows, and the server
  accepts it, only for a viewer who may change applications in that division: the same rule as
  every other move on an application. A Members grant alone neither sees the banner's button nor
  confirms. Once the person has joined, everything about them (details, role, removal, alumni) is
  the Members area's.
- Confirm join for someone new asks "Confirm {name} joins {division}?" in neutral words (they,
  their), whatever the application form says (board 58h).
- Someone already on the team follows the same statuses as any applicant, with no special path
  and no skipped status: after "Accepted · email sent", the team leader sets "NDA received" as
  usual, then Confirm join adds them to the new division, and they keep every division they are
  in ([ruling R1.3](https://github.com/PoliTo-Rocket-Team/website-v2/issues/745#issuecomment-6399754015),
  amending rule 4 of [0014](../.decisions/0014-several-divisions-one-nda.md)). This replaces the
  earlier no-NDA-wait Confirm join with an "Add to {division}" button (board 58h2, #229).
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
- A role title is stored (`roles.title`) and every page that names a head or a team-level seat by
  its role shows it as stored (#625): Members, the Team tree, the Team page, the line under a name
  on Access and Close department's head label. A hand-over's full-access line names the seat that
  moves ("becomes Operations lead"), not the role's title. A head row is
  written with "Head of {department}"; a department rename rewrites only head titles still at
  the old default. The default shows only for a blank title. No page decides a seat or a
  headship by a title's text, so a rename never moves anyone or changes any access.
- The Team tree's seat row, under the team leader, holds every team-level seat: an active role in
  no department and no division that is not the team leader's, a head's or an advisor's. The
  Project Manager and the Chief Engineer, read from their `roles.full_access` flag, come first;
  any other seat follows by start date. The Team page's arc lists them in the same order. Each
  seat is drawn as a box built like the team leader's, in one row directly under it, on every
  width (#627).
- R&D is a department with a head and no divisions (Owner decision, 2026-10-24, #627). The Team
  tree and Edit team tree draw it as a department box with its head, never on the seat row.
  Department 8, Research and Development (code RND), is the real R&D department: its only head
  is the Head of R&D, and it has no divisions (Owner decision, 2026-10-24, #600). The seed adds
  no test-only department, division or head, so the public Team page shows only real units; the
  department-head test seat is the seeded head of Propulsion (Owner decision, 2026-10-24, #644).
  Migration 0059 makes a Head of R&D role kept in no unit the head of the R&D department
  (coded RND, or named R&D or Research and Development), only while that department has no
  head, and adds the department only when none is open, so there is never a second R&D
  department and no department gets two heads (Owner decision, 2026-10-24, #600). The public
  Team page is laid out apart: a department with no division has no block on its departments
  carousel, so its head shows as a core member, where the Team page editor can place them on
  the arc, as before.
- **Superseded:** rule 7 of [0011](../.decisions/0011-applicant-journey-received-to-joining.md),
  "one person, one division", no longer holds. [0014](../.decisions/0014-several-divisions-one-nda.md)
  replaces it. Its first amendment of 0011's Confirm join rule for someone already on the team
  is undone by its 2026-10-25 amendment: they follow the same statuses as any applicant.
- My profile shows every division the person is in, one role per line, the home division first.
  Access places each person in one division of the lead's: the one they lead there, else their
  oldest (#185).

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
  - **Team leader:** only a current team leader, their own role, from the Team Leader box in the
    Team tree's edit view (board 77i). Full access opens the box only to add another team leader
    (#869), with no hand-over in it; it is locked for everyone else, and the server refuses a
    hand-over by anyone but a team leader.
  - **Department head:** the team leader or full access, with Change head in Edit department
    (board 77e).
  - **Division lead:** the department's head, the team leader, full access or a lead of the
    division (#594), when a new lead replaces them in Edit division (board 68b4).
- **Access after a hand-over** (Owner decision, 2026-10-16): a lead or head who becomes an
  advisor loses every access row they held; they keep only the Advisor role in their own unit.
  A former team leader who becomes an advisor keeps every access row they hold, and the full
  access their role gave them stays with them as an org-wide access row, until the new team
  leader changes it in Access (#247).
- The team leader's own powers (deciding orders by default, giving "Approve orders", handing the
  role over) belong to the role, so they move to the new team leader on save.
- The person who takes over keeps every role they already hold.
- **A co-holder's hand-over** (epic #861,
  [#872](https://github.com/PoliTo-Rocket-Team/website-v2/issues/872)): when a seat has several
  holders, a hand-over or replacement by one of them ends that holder's row only. Every other
  holder keeps the seat and its full rights, on every seat kind:
  - **Team leader:** any team leader hands over their own place from the Team Leader box. The
    other team leaders stay team leaders.
  - **Full-access seat and any other team-level seat:** Change holder and Remove act on the
    holder picked on that holder's own row in the seat's panel. Remove ends that row only; the
    seat leaves the Team tree only with its last holder.
  - **Department head:** Change head replaces the one head picked on that head's row in Edit
    department; with several heads, a save that names none is refused. A confirmed hand-over
    request from one head ends only that head's row. A move that makes someone head of a
    department with several heads replaces the one head picked in the move's confirm.
  - The successor may not already hold that exact seat, by any holder's row: the server refuses
    them on each seat kind with the reason Add another holder gives ("{name} holds this seat
    now.", or "{name} already heads this department."), and writes nothing.
  - The drawers name which holder a replace or remove applies to: with several holders, each
    holder's row has its own Replace (and, on a team-level seat, Remove), and the confirm says
    the other holders stay.
  - A team address tied to the seat and held by a holder who stays gets no routing item (#789):
    only the address of the holder who hands over moves, to the successor.
- A lead taken off with Remove and no replacement is not a hand-over: Remove keeps its three
  outcomes (see Divisions below).
- **A role holder's own request from My profile** (#262, boards 55d and 62c; Owner decisions of
  2026-10-16):
  - A division lead and a department head see **Hand over your role** on My profile in place of
    "Leave the team". A member with no role, and the team leader, keep "Leave the team" (the team
    leader hands over from the Team Leader box, board 77i). The server refuses Leave the team
    for a lead or a head.
  - Someone who leads a division and heads a department hands over the department. Someone who
    leads two divisions hands over the oldest one.
  - The dialog asks two things, with nothing picked at first: **1. Who takes over**, a select of
    the people in their unit (everyone else in the lead's division, a co-lead included; everyone
    in a division of the head's department who does not head it already), and **2. After you
    hand it over**: Become an advisor ("Stay in <unit> with the Advisor role, without the lead
    role. Your access ends.") or Leave the team.
  - **Send for confirmation** stores a **pending hand-over** and changes no role and no access.
    One request waits per person; My profile then shows that it waits, for whom, and what they do
    next. It is refused when nobody could confirm it (no head in the department, or no team
    leader).
  - **Who confirms:** the next level up. A head of the lead's department confirms a division
    lead's request; the team leader confirms a department head's. Nobody answers their own
    request. Only they see the request, and the server refuses Confirm and Decline from
    everyone else, full access included.
  - **The approver's row (board 62c):** the request is the top row of "Needs your attention" on
    their Overview, on an accent background: "<person> wants to hand over <role> to <successor>",
    then "Sent <when> · <first name> then becomes an advisor, without access" (or "then leaves the
    team"), with **Decline** and **Confirm**.
  - **A request lapses** when its sender's roles change before anyone answers it: removed as
    lead, a division or department closed, made a head, or any other change to which roles they
    hold (a title edit is not one). A lapsed request is closed for good: nobody sees or answers
    it, it never blocks the sender's next Send for confirmation, and it never comes back with its
    old successor, even when they hold the role again. Nobody is notified; the sender sends a new
    one if they still want to.
  - **Confirm** runs the hand-over at once with the chosen successor and outcome: the successor
    holds the role and its access (a lead's successor leads the division; a head's successor
    gets a head role on the department and keeps every role they hold). A sender who chose
    Become an advisor keeps only the Advisor role in their unit, and **every access row they held
    is removed**; one who chose Leave the team leaves, as Leaves the team does. Confirm is
    refused when the successor is no longer in the unit; Decline still answers it.
  - **Decline** changes no role. The sender may send a new request.
  - **Both answers notify the sender:** a notice under "Needs your attention" on their Overview
    ("<approver> confirmed your hand-over" or "declined"). A sender who is now an advisor reads it
    on their Overview, as every seat does.
  - **Gap:** a sender who chose Leave the team is off the team once it is confirmed. Their notice
    is stored, but the applicant's pages show no notices.

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
- Edit details is one panel for every viewer who may edit a member (#584, Owner decision,
  2026-10-22): the same panel opens from the member panel on the whole team, a department and a
  division. Who may edit a member: the team leader, full access and the operations lead, anyone on
  the team; a department head, the people in their department's divisions; a division lead, or a
  member with a Members grant at Can edit, the people in the divisions it covers. Nobody edits
  themselves here. A Members grant at Can view, or a grant on another area, opens no editor, and
  the server refuses every write below from it.
  - Details (board 61g): photo, contact, studies and personal details, with the same field checks.
  - Role: the person's title in one division, shown on the Team page: the division the page lists
    them under, else their first division the editor reaches. Titles in their other divisions
    show on the member panel, not in the form. Someone in no division the editor reaches who holds
    a seat (the team leader, a department head, the Project Manager, the Chief Engineer or another
    team-level seat) shows their seat's stored title as an editable Role, and only the team
    leader and full access reach them (issue #626). A blank stored title shows as the seat's
    default name ("Team Leader", "Head of Aerodynamics"). It may not be blank. Save writes that
    seat row's title and nothing else: never its type, department, division or full access, so
    the seat, the headship and every access stay. A save with the Role left as shown writes the
    title back unchanged. The team leader's title is the one on the public Team page; the
    Members Role column names that seat "Team Leader" whatever it stores.
    Someone with no such seat (an Advisor role, a role kept on a department) shows their role
    locked.
  - Lead or member: one choice per division of the person where the editor may change who leads
    it, as Edit division allows: the department's head, the team leader, full access, and a lead
    of that division by role (#594). A Members grant never shows it, and the server refuses its
    change.
  - Leaving the team (board 46b): "Remove from {division}" for each of the person's divisions the
    editor reaches, and "Move to alumni", under the rules of the ⋯ menu below. An action the editor
    may not take is locked with the menu's reason, and opens the menu's own "are you sure".
  - Save writes the details and the title, then each changed lead or member choice. The server
    checks each against the same rules.
- The row ⋯ menu has "Remove from {division}" and "Leaves the team", on every Members page.
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
- A lead renames, recodes and changes the leads of each division they lead by role, in Edit
  division (see Divisions below; Owner decision, 2026-10-24, on #594). A Members grant does not:
  a page reached only through one shows "Leads are changed by the Head of {department}", and the
  server refuses that lead change.

- The role in Edit details is the person's title on the Team page. The public Team page is built
  from the team's roles, so a saved title shows there once the `team-roster` cache refreshes
  (ADR 0015).
- A division's leads change through Edit division (see Divisions below), or through Edit
  details' lead or member choice, for the same people: the department's head, the team leader,
  full access (#231, #584) and a lead of the division by role (#594). "Remove from {division}" on
  a lead follows the same rule. The Members page has no Promote (removed by #551).
  - A "promoted" notice written while Promote existed (#188) still shows under "Needs your
    attention" until it is dismissed.
- Move to alumni in Edit details is the same "Leaves the team": every role and every access ends,
  after a confirm with the years and an optional reason.
- Leave the team (by the member) is confirmed, with an optional reason. The lead and the
  recruitment manager are told. The person moves to Alumni. A division lead or a department head
  hands their role over instead (see Handing over a role).
  - The lead of each division the person was in gets a notice under "Needs your attention" on
    their Overview, until they dismiss it (#201).
  - The recruitment manager is the lead of the Logistics division (Operations department), by
    the owner ruling on #194
    (https://github.com/PoliTo-Rocket-Team/website-v2/issues/194#issuecomment-6341780484). Each
    lead of the open Logistics division gets the same notice, naming every division the person
    was in. A Logistics lead who also leads one of those divisions gets one notice, not two. When
    Logistics is closed or has no lead, nobody extra is told (#705).
- Someone with no active role left (they left, or were moved to Alumni) signs in as an alumnus
  when the Alumni record knows them, else as a non-member (#201, #317). Either way they open on
  their Overview.
- Delete account: the person types DELETE. It closes the sign-in. The data is kept at least one
  year, then anonymized for statistics. The Privacy Policy must say so (#122). A non-member may
  also withdraw their applications in the same dialog ("Also withdraw all my applications").
  Ticked, it withdraws every application of the account not withdrawn yet, whatever its status,
  in the same write that deletes their files, so an application sent or moved on meanwhile never
  keeps a link to a deleted file (Owner decision, #831). A file an application withdrawn before
  still uses is kept.
- Anonymization locks the person's row and checks again, in the write itself, that the person is
  still deleted, not anonymized and not signed in again; a sign-in that starts meanwhile waits for
  it. Only then are their files deleted (#831).
- Anonymization also clears the person's free-text answers to a position's questions, on the
  application and in the audit log copies (#729). The role, dates and outcome stay for statistics.
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
  Edit details, Remove from {division} and Leaves the team. Confirm join follows the Applications
  rule above. The server refuses the rest.
- The page has no "+ New division", "Edit division", "Close division" or "Reopen": the head edits
  their divisions in the Team tree's edit view (below).

#### Team structure

These rules come from the Owner decisions of 2026-10-16 on #251 (boards 77 to 77g, 66t and 66t-b).

- Structure is edited in one place: the Team tree's edit view. The Team tree header shows one
  **Edit** button to the team leader, to full access (#238), to a department head and to a
  division lead (#594). A member gets none, and so does a Members grant on its own.
- The edit view shows the team leader on top and one column per open department: its box (name,
  head, how many people), then each division's box (name, lead, how many people), every box
  collapsed. **Done** returns to the tree. There is no closed-divisions list.
- The team leader and full access see a pencil on every box, **+ Add division** under each
  department column and **+ Add department** at the end of the row (board 77b).
- A department head sees pencils and **+ Add division** only on their own department's divisions.
  Every other department is dimmed and read-only, and no department has a pencil or Add
  department (board 66t-b). The server refuses a division create, edit or close by a head outside
  their own department, not only the page.
- A division lead sees a pencil only on each division they lead by role, and no **+ Add
  division**, department pencil or **+ Add department** (#594). Departments with none of their
  divisions are dimmed. The intro line names the divisions they can edit. The server refuses
  their edit of any other division, not only the page.
- A division's pencil opens Edit division (below), with **Close division** in its footer for its
  department's head, the team leader and full access; a lead's Edit division has none. Add
  division opens New division in the department of the column it is under.
- Every box for a seat names every holder of it (epic #861, issue #869): the Team Leader box
  every team leader, a department box every head, and a seat box every holder. One holder is
  drawn as before; several are one row each, their photo beside their name, over the seat's
  name ("Team Leaders", "Heads · 12 people"). A department counts each person once, every head
  included.
- The **Team Leader box** on top opens its panel, with a pencil, for a team leader and for full
  access. A team leader's is "Hand over your role" (board 77i, #253), which hands over their own
  role. Both list every team leader and offer **Add another holder** (below). For everyone else
  it shows a lock and opens nothing (see "Handing over a role" above).
- The **seat row** (#627) sits directly under the Team Leader box and above the department
  columns: one box per team-level seat, built like the Team Leader box, with every holder's name
  and the seat's stored title, in the Team tree's seat order. A seat is what its rows share, as
  Add another holder reads it (below). Everyone who opens the edit view sees the same row. A row
  too wide for the frame shrinks to fit it, as the department row does.
  - For the team leader and full access, each seat box has a pencil and opens **Change
    holder** with **Add another holder** beside it, and the row ends in **+ Add seat**, in the
    Add department style. For a head the boxes open nothing and there is no Add seat. The server
    refuses these writes to everyone but the team leader and full access.
  - **Change holder** picks who holds the seat from the team. As in Change head, a person who
    holds another seat may be picked and keeps it; their seat shows on the row as information.
    Only a holder of this seat cannot be picked ("{name} holds this seat now.", #872). With
    several holders, each holder's row has its own Replace and Remove, which act on that holder
    alone (see "A co-holder's hand-over" above). The successor keeps their
    divisions. The holder gets "What happens to {name}?": Become an advisor (on the whole
    team, their access ends) or Leave the team, with neither picked at first. On save the
    holder's seat role ends and the successor's starts with the same title and the same
    `roles.full_access` flag, so the Project Manager's and the Chief Engineer's full access
    moves with the seat.
  - A seat box changes who holds the seat, never its title: the title is changed on Members,
    in Edit details (#626).
  - **Add seat** takes a title and one person from the team. A person who holds another seat may
    be picked and keeps it; the new seat has no holder yet, so nobody is refused. It starts an
    active role in no department and no division with that title and no full-access flag, so a
    new seat gives no access of its own. It shows on the Team tree's seat row, this row and the
    public Team page's arc. Ending a seat with no successor is not offered.
- **Add another holder** (epic #861, issues #868 and #869) gives a seat one more holder beside the
  ones it has, on every seat kind. The Team tree offers it beside the replace action: in the Team
  Leader panel, in a seat's Change holder panel and under Change head in Edit department (when
  the department has a head). It picks one person from the team; anyone who holds that exact seat
  is listed but cannot be picked, with the reason the server gives ("{name} holds this seat
  now.", `holderAddRefusal`). The save asks "are you sure" first, and then the seat's box names
  the new holder. The rules (`lib/dashboard/seat-holders.ts`):
  - Only the team leader and full access may add a holder; a department head, a division lead
    and a member are refused, and a refusal writes nothing.
  - The person is on the team and does not hold that exact seat already. Someone who holds a
    different seat may be added and keeps it, with every role and division they hold.
  - A seat is what its rows share: the team leader seat by the `president` type, a full-access
    seat by its `roles.full_access` flag on whatever row carries it, a department's head seat by
    the department (`headDepartmentOf`), and any other team-level seat by its type and stored
    title.
  - The new holder's role copies the seat. A new team leader gets a `president` row with the
    title the first team leader row stores ("Team Leader" when blank). A new holder of a
    team-level seat, flagged or not, gets that seat row's type, title and full-access flag, so a
    second Project Manager gets full access. A new head gets a head row on the department,
    titled as a new head's is ("Head of {department}"), with no full-access flag: a seat kept on
    another head's row is that seat's, not the head's.
  - Adding a holder ends no row: every holder keeps the seat, in one audited batch.
  - A new team leader and a new head get the automatic alias request a hand-over gives (#543).
    A team address tied to the seat gets a routing item only when its holder holds the seat no
    more (#789): beside a holder who still holds it, nothing moves.

#### Departments

- Only the team leader and full access create, edit or close a department. A department head
  never can, not even their own. The server refuses everyone else.
- **New department** (board 77d) needs a name, a code of 2 or 3 letters no other open department
  uses, a kind (Technical, picked first, or Operations; #325), and exactly one head, picked from
  the team. The kind picks the slide of the public Team page's departments carousel the head sits
  on (ADR 0015). The head keeps their divisions. A person who holds another seat (the team
  leader, a board seat, an advisor role, another department's head) may be picked and keeps it;
  their seat shows on the row as information. The department is new, so nobody is refused.
  Divisions are added after, with Add division.
- **Edit department** (board 77e) shows the name, the code, the kind, the head, and the divisions
  as rows that open to list their people, lead first, read-only. Save changes stores a new name,
  code or kind, after an "are you sure" that lists each change.
- **Change head** (board 77e, #253), under the head in Edit department, picks the new head from
  the team. As in New department, a person who holds another seat may be picked and keeps it.
  Only a current head cannot be picked ("Heads it now"). With several heads, Change head is each
  head's own Replace, and the new head replaces that head alone; the others stay (#872). The new
  head keeps their divisions. The head they replace gets "What happens to {name}?":
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

These rules come from the Owner decisions of 2026-10-11 on #232 (boards 68b to 68c and 69d), of
2026-10-16 on #251 and of 2026-10-24 on #594.

- Only the head of a division's department, the team leader or full access creates or closes it.
  They edit it, and so does a **division lead**, for each division they lead by role: its name
  (and so its code), who leads it (add, replace and remove leads) and its members (add from the
  team, an email that waits for Confirm NDA, remove). This replaces the #231 rule, that only the
  head changes a division's leads, for a lead's own division (Owner decision, 2026-10-24,
  https://github.com/PoliTo-Rocket-Team/website-v2/issues/594#issuecomment-6385484701).
  - A lead's right comes from their lead role, never from an access grant: a Members grant at
    Can edit adds and removes members in the divisions it covers, as on Members, and opens no
    Edit division there.
  - A lead never creates or closes a division, not even their own.
  - Every rule below holds for a lead's save as it does for a head's. The server refuses everyone
    else.
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

### PRT emails

These rules come from the Owner decisions of 2026-10-27 on issue #798. They set how the two
stored kinds below, the email alias and the team address, read in the dashboard. Who may ask,
who may answer and hand-over routing do not change.

- The dashboard calls both kinds a "PRT email". The member's own address is the **personal**
  one; a shared address such as recruitment@ is a **special** one. Neither "alias" nor "team
  address" shows in the dashboard.
- The member side view's Contact section has one "PRT emails" row, in place of the PRT email and
  Team addresses rows. It lists the personal address, labelled "personal", or the open personal
  request (Requested, who sent it and when, and Cancel request where allowed), then each special
  address, labelled "special" with what it is for and "moves with" its role when tied. Each
  address has a copy button; each special line keeps Remove (issue #797), and the personal line
  has none. "Removal waiting" sits under its address, and the copy button keeps the same place on
  every line. The row is hidden when the member holds nothing, has no open request and the
  viewer may not ask.
- **Request PRT email** ends the row whenever `mayAskFor` lets the viewer ask for the member,
  whatever they hold. It opens one dialog with two choices. **Personal** is offered only while
  the member has no personal address and no open personal request: its address is pre-filled as
  firstname.lastname on the team domain, may be edited, and is checked on both sides with the
  alias address check, then Cancel or Confirm. It is refused when the address is already a PRT
  email of either kind. The request stores the address (`alias_requests.address`); a request the
  site makes by itself stores none. **Special** is the request form of the Team addresses
  section below, unchanged.
- Each approver sees every open personal or special request as one kind of item, "PRT email
  request for" the member, then "Personal" or "Special", the address and who asked. Mark created
  starts from the address asked for, or from the member's name when none was stored, and shows
  the Forwards to row for both.

### Email aliases

These rules come from the Owner decisions of 2026-10-22 on epic #538 and issue #563 (boards 94 to
94e, `lib/dashboard/alias-request.ts`). Since issue #798 the dashboard names this kind the
personal PRT email, and the PRT emails section above sets how it reads.

- A member's team address lives in one field, their PRT email (`members.prt_email`), and their
  email alias is that address. A member may be asked for an alias, by hand or by the site, when
  their PRT email is empty and no request is open. Clearing a wrong PRT email makes them
  requestable again.
- A division lead, a department head or the team leader asks for a member's personal PRT email
  with the Personal choice of Request PRT email, in the PRT emails row of the member drawer
  (board 94; the PRT emails section above): a lead for their division, a head for their
  department, the team leader for anyone. Personal is offered only while the PRT email is empty
  and no request is open. Nobody asks for themselves, and a grant makes nobody a requester. The
  row then shows Requested, who sent it and when, and Cancel request (board 94b).
- A member has at most one open request, kept by the server and by the database
  (`alias_requests_one_open`).
- The site asks by itself (issue #543, `owedAliasRequests`) whenever someone becomes a division
  lead, a department head or the team leader: Edit division and New division naming a new lead,
  New department and Change head, the team leader hand-over, and a confirmed hand-over request.
  The request is written with the role change, so a change refused or failed asks for nothing,
  and only when the person's PRT email is empty and no request is open. Close division and Close department make
  nobody a lead or a head, so they never ask. Request PRT email stays for everyone else.
- Only the team leader, the operations lead and the IT lead answer. Each open request is one
  "PRT email request" item on their Overview (board 94c; the PRT emails section above), with
  Decline and Mark created. The Project Manager and the Chief Engineer get none, and neither does
  full access from an access row alone. A request the site made by itself has no requester and
  reads "Personal · automatic".
- Mark created asks for the address (board 94d), prefilled with the address asked for, or as
  firstname.lastname on the team domain when the request stored none. The server accepts
  firstname.lastname, or one word for a special-purpose address, and only on the team domain.
  The address is saved as the member's PRT email and shown as the personal line of the drawer's
  PRT emails row (board 94e). Mark created and Decline each tell the requester with a notice.
- The member gets no notice. Their own Overview shows the "Your PRT email is ready" card
  (board 94f, issue #542, `lib/dashboard/alias-setup.ts`, owner ruling on #550) until they set
  the address up. The card reads the address from their PRT email, so it shows for any member
  with a PRT email who has not set it up yet. Open setup steps opens "Set up your PRT email"
  (board 94g). Close only closes it; the card stays until the member presses "I've set it up", which is
  stored on their own record (`email_alias_set_up_at`) only while they have a PRT email and have
  not set it up. The card shows on every Overview shape, a lead's as a member's, and never off
  the team.
- My profile shows the team email in the member's own details, with a "Setup steps" link to the
  same panel at any time. Nobody reads or sets up another member's alias from either page.
- The Members export to Excel has the PRT email column, which holds the alias once it is
  created.
- The alias is created by hand in Google Workspace. The site creates nothing there and sends no
  email.
- When a member with a PRT email leaves the team, the approvers are asked to remove it (issue
  #931, `lib/dashboard/prt-email-removal.ts`, Owner decisions of 2026-10-31). Leaving is any
  write after which the member holds no active role: Leave the team, Move to alumni, a hand-over
  or a replace that ends their last role, the end of their last advisor role. The database opens
  the removal as that write commits (`drizzle/0080`), so every way of leaving is covered, and
  the leave is never refused because of it. A member with no PRT email gets none.
- The same leave cancels the member's own open PRT email request, if one is open. The
  cancellation shows in the Activity log under who made the leave.
- A member who stays on as an advisor (division, department or team) keeps the address and any
  open PRT email request; the removal opens, and the request is cancelled, when their last
  advisor role ends.
- One address has at most one open removal, in any letter case (`prt_email_removals_one_open`).
  A member who rejoins the team before it is answered has it cancelled. A member who takes an
  advisor role again leaves it open: the approvers answer it with Keep address or Mark done.
- Each open removal is one "Remove … from …" item on the approvers' Overview, every holder of
  each seat, drawn as a team address removal's, with Keep address and Mark done. Mark done is
  pressed once the mailbox is deleted in Google Workspace: it clears the member's PRT email.
  Keep address closes it and leaves the PRT email; that leave asks no more, and a later leave
  asks again. Either answer is final and shows in the Activity log under who gave it; a second
  answer, from another approver, is refused and writes nothing.

### Team addresses

These rules come from the Owner decision of 2026-10-26 on epic #578 (boards 102 and 102b,
`lib/dashboard/team-address.ts`). Since issue #798 the dashboard names this kind the special PRT
email, and the PRT emails section above sets how it reads.

- A team address is a shared address on the team domain, such as a recruitment or logistics
  address. It is held by one member, says what it is for, and may move with a role: the team
  leader, a full-access seat, a department's head or a division's lead (grill #785). It is
  separate from the personal PRT email (the email alias), whose rules do not change.
- One address has one holder, in any letter case (`team_addresses_address`). A tie stores
  exactly the reference its kind needs (`team_addresses_tie`).
- The member side view lists each team address the member holds as a "special" line of the PRT
  emails row in the Contact section (board 102; the PRT emails section above), after the
  personal line, sorted by address, each with a copy button. Each line also names what it is for
  and, when tied, "moves with" the role as the org chart names it, for example "Logistics Lead".
- The row shows to every viewer who reaches the Members page and opens the member, and hides as
  the PRT emails section above says.
- Who may request a team address follows the alias rule of issue #721: a division lead for a
  member of a division they lead, a department head for a member of their department, and anyone
  with full access for any member on the team, themselves included. For them, Request PRT email
  ends the row, and its Special choice is the request form below (board 102b). The server runs
  the same check (`mayAskFor`), so the button shows exactly when a request would be accepted.
- The Special form asks for the address (the part before the team domain, which the box shows
  as a fixed ending), what it is for (required, up to 120 characters) and, optionally, the role it
  moves with: the team leader, a full-access seat, or a department head or division lead on the
  current org chart. The address check is the alias one: one word or a dotted name, on the team
  domain only.
- One address has at most one open request, in any letter case. A request is refused when the
  address is already a team address or already has an open request; the database index
  `team_address_requests_one_open` refuses the second of two requests sent at once, with the same
  message.
- The alias approvers answer team address requests (issue #788): the team leader, the operations
  lead and the IT lead (`ALIAS_APPROVER_SEATS`). The Project Manager, the Chief Engineer, a lead,
  a head and full access from an access row alone do not, and the server refuses them.
- Each approver sees one Needs your attention row per open request, oldest first, as the same
  "PRT email request for" the member item as a personal request (board 94c) with its at-sign,
  then "Special", the address, what it is for, the role it moves with, if any, who asked and when
  it was sent. A request for someone no longer on the team is not shown.
- **Decline** closes the request and stores nothing under the member. **Mark created** opens a
  dialog like the alias one (board 94d): what it is for, read-only; a "Forwards to" row with the
  member's sign-in email and a copy button, as in the alias dialog (issue #586), for Google
  Workspace's recipient address map; and the address, prefilled with the one asked for. The address
  is checked again on the team domain, then stored under the member with the request's purpose and
  moves-with role, and the request closes. It is refused, and the request stays open, when the address is a
  team address already (also when it became one meanwhile: `team_addresses_address` refuses the
  second holder) or another open request asks for it.
- The request is closed first, so a second answer is refused with "This PRT email request was
  already answered." If saving the address or the notice then fails, the request opens again; when
  a newer request for the address came in meanwhile, that one is kept and the answer is refused.
- Either answer leaves the requester a notice, themselves included when they asked for their own
  address: "recruitment@politorocketteam.it is ready for Davide Russo", or "Sara Conti declined
  recruitment@politorocketteam.it for Davide Russo · you can ask again". A request whose
  requester's record is gone tells nobody.
- When the role an address moves with changes hands, the role change raises one routing item for
  the address (issue #789; grill #785, R1.2): when the change makes someone a holder of that role
  and the address's holder does not hold it after the change. Adding a co-lead while the holder
  still leads the division raises none, and so does an address tied to no role. When one change
  makes two new holders, the first by member id is named. The item names the address, the member
  it goes to and the member it came from.
- Every role change that asks for an automatic alias raises the routing items it owes, in the
  same batch: Move to another unit, Edit division and New division, New department, Change head,
  the team leader hand-over and a confirmed hand-over request. Change holder on a seat raises the
  item for an address tied to that full-access seat, and so does any of those changes that moves
  a seat with the role. A role change that is refused or fails leaves no routing item.
- One address has at most one open routing item (`team_address_reroutes_one_open`). A second role
  change before Mark done adds no second item; the open one stays as it is.
- Each approver (the team leader, the operations lead and the IT lead) sees one Needs your
  attention row per open item, oldest first, with the at-sign: the address and who it goes to,
  then the role and when it changed hands, whose address it was and the new holder's sign-in
  email, with **Mark done**. Mark done opens a dialog drawn like Mark created's: the new holder's
  sign-in email as the "Forwards to" row with a copy button, then Cancel and Mark done. An item for
  someone no longer on the team is not shown.
- **Mark done** in that dialog claims the item and, in the same batch, makes the new holder the
  address's holder and clears its set-up, so it leaves the previous holder's PRT emails row and
  shows on the new holder's. A second Mark done is refused with "This PRT email was already
  moved." Nobody else may mark it done, and the server refuses them.
- The holder of a team address gets the alias's ready card (board 94f) on their own Overview, under
  the person, after Mark created and after a routing item's Mark done (owner findings of
  2026-10-26 on PR #794): "Your special PRT email is ready:" and the address, with Open setup
  steps. The steps are the alias's (board 94g), titled "Set up your special PRT email". The card stays until the holder presses **I've set it up** in the steps; Close
  only closes them. The press is stored on the address (`team_addresses.set_up_at`), only by its
  holder and only once, so each address not set up has its own card, by address, under the alias
  card. The steps for a team address have no way back from My profile.
- A team address can be removed from its holder (Owner decision of 2026-10-27, issue #797). Who
  may remove it is who may request a team address for its holder (`mayAskFor`): for them each
  special line of the PRT emails row ends with **Remove**, which asks first ("Keep address" or
  "Remove"). The server runs the same check and refuses anyone else, writing nothing. It stores
  the removal only while the address still has the holder that check read: if a routing item's
  Mark done moved it to another member meanwhile, or is moving it at that moment, Remove waits
  for it, is refused and stores nothing. A routing item's Mark done that comes after Remove is
  stored is refused and moves nothing, so a removal never stays open on an address that then
  moves away.
- Remove stores one open removal for the address (`team_address_removals`). While it waits, the
  line shows "Removal waiting" to every viewer of the row, with no Remove, and a second Remove is
  refused, also when two are sent at once (`team_address_removals_one_open`). The address still
  counts as held, so a request for it is refused as a team address already.
- Each approver (the team leader, the operations lead and the IT lead) sees one Needs your
  attention row per open removal, oldest first, with the at-sign: "Remove" the address "from" its
  holder, then what it is for, who asked and when, with **Mark done**. Its dialog asks to turn off
  the routing in Google Workspace first. Nobody else sees the row or may mark it done. The row
  stays, with Mark done, when the holder leaves the team after Remove.
- **Mark done** deletes the address in the same batch that closes the removal: it leaves the
  holder's PRT emails row and their Overview card, and Request PRT email takes it again, in any
  letter case, for any member. The removal row keeps the address, whose it was, who removed it
  and when, and who marked it done. A second Mark done is refused with "This PRT email was
  already removed."
- A removal and a routing item never both move one address. While a removal waits, the
  address's routing item is not shown and its Mark done is refused; the removal's Mark done
  deletes the routing item with the address. Removing an address does not change how routing
  items are raised.

### Access

These rules come from #213 (boards 60, 60b, 60c and 60m).

- There are two levels: **Can view** and **Can edit**. Can view lets a person see an area. Can
  edit also lets them change it. There is no third level.
- There are four areas, each scoped to the lead's division: **Positions**, **Applications**,
  **Members** and **Orders**.
  - Applications at Can edit moves applications between steps and accepts or rejects them.
  - Positions at Can edit opens, closes, adds and edits positions. A grant at Can view, or on
    another area, changes neither page, and no grant makes its holder a division lead (#160).
  - Where a person may not change a position or an application, its drawer opens read-only:
    the position's text and lists as plain text with only Close at the foot, and the
    application's status as a pill with no Status picker, no footer actions and no Change times.
    Opening an application never changes its status, for anyone (section 2). It is the same
    drawer every role opens; only the actions differ (#577).
  - A member's Positions and Applications lines name what their grant covers, once: "Every role
    in the team." and "Applications for every role in the team." for a grant across the team,
    else the department or division it names, never their own division, and a count past two
    places. Their recruitment notice reads "Open roles are public on the site.", with no "Your"
    (#577).
  - Orders at either level shows every order in the team (#233). Orders at Can edit also lets
    them request, edit and cancel the orders of that division. Orders at Can view edits nothing.
    A person with no Orders access does not see the Orders page.
  - Each area stands alone (#471). A grant shows its own area, in the units it names, and
    nothing of the other areas. A member granted some areas sees only those pages in the
    sidebar and only those areas' figures and rows on the Overview. The server refuses every
    read and action outside them, application files included. Access is no area, so no grant
    opens it.
- A person holds each area at one level or not at all. In both drawers each area has a tick; a
  ticked area takes its own level, and an unticked area means no access.
- Delegation limit: a lead gives only an area they hold, and only up to their own level in it.
  They cannot change or remove access held above their level, or another lead's role access. The
  server checks every change, not only the drawer.
- A division lead's role gives Positions, Applications, Members and Orders at Can edit in each
  division they lead (#591, #590, #632). "Your access" counts them with no grant, so a lead with
  no grants still has Give access. Grants the lead also holds there are added on top. Since the
  role holds Orders, a lead with no Orders grant can give Orders (Can view or Can edit) to people
  in their own division, by the same delegation limit as the other areas (#632).
- **Role access is locked; every other grant is a normal grant** (#591). The access a lead's or
  head's role gives (their "With the role" row) is never given, changed or removed on Access, and
  the server refuses any change that would touch it. A stored row for an area the role already
  gives there is not listed as a grant and is left in place by "Remove all access"; once the
  person no longer holds that role, the row shows again as an ordinary grant (#632). Any other
  grant (Content, or an area in a place their role does not cover, such as Orders in another
  division, across a department or across the whole team) can be given to a lead or head, is listed in a row
  of its own beside their role row, and can be changed or removed, within the usual delegation
  limit. Give access lists the leads and heads in reach, never the viewer, and only when the viewer
  can give them something their role does not already give. Full-access seats hold every area, so
  nothing is given to them.
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
  role" and a lock. Their role access cannot be changed or removed here; their other grants show
  in a row of their own (#591). A lead's own page shows their co-leads, never the lead themselves
  (Owner decision, #230).

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
  only inside their department. A lead's role access cannot be changed or removed, but a head
  gives the division leads of their department other grants, such as an area across the whole
  department, and changes or removes them (#591). The server checks
  every change.
- Edit access (board 65c) locks the person ("can't be changed") and keeps "Where" editable. It
  opens on the first place the person holds access in; changing "Where" shows their areas in
  that place. The foot has "Remove all access" and "Save". "Remove all access" removes every
  area in every place, after a confirm.

#### Full access

These rules come from #238 and #247 (boards 71 and 71b).

- The full-access seats are the team leader, the operations lead, the IT lead, the Project
  Manager, the Chief Engineer (#485) and the Logistics lead (#885). On the Full access tab each
  shows under its label: "Team leader", "Operations lead", "IT lead", "Project Manager", "Chief
  Engineer", "Logistics Lead". The Full access tab counts and lists every active Logistics lead.
- Full access holds every area at Can edit across the whole team, Content included: "YOUR ACCESS ·
  Full access, whole team", with one "Every area · Can edit" chip, and "Approve orders" for the
  team leader.
- Above the table: Everyone, Full access and Approve orders tabs, each with its count, and an "All
  departments" select. The other full-access seats show first ("Full access · Whole team", "With
  the role", locked), then the heads and division leads with their role's access, locked.
- Give access picks a person from the whole team and a Where: the whole team (a `team` scope row
  in no unit, which covers every department and any added later), one department, or one division.
  The areas are Positions, Applications, Members, Content and Orders, each at Can view or Can
  edit but Content. There is no Alumni area: the Alumni page comes with Content (Owner decision,
  2026-10-22, #589). Content (#504) has no level toggle: it is given at Can edit only. Content is
  given to the whole team only, and the server refuses it in a department or a division, refuses
  it at Can view, and refuses an Alumni area from anyone.
- A division lead or department head who holds a Content grant also gives Content: their Where
  adds the whole team, last, where they give Content alone. Nobody else is offered Content, and
  the server refuses it from them.
- **Approve orders** is a checkbox in Give access that only the team leader sees; the server refuses
  it from anyone else. The other full-access seats give every other access. The Activity
  log is never given: it stays the IT lead's.
- The delegation limit still holds: no area above the viewer's own level, and no lead's or head's
  role access changes here. Every other grant can be given to, listed for and removed from leads
  and heads (#591): a head's role covers the unit areas in their department and its divisions, so
  Content or an area elsewhere on the team is a grant. Full-access seats take no other grant,
  since their role holds every area, but the team leader can give them "Approve orders" and
  remove it (#635): Give access lists them for the team leader only, and only with that checkbox.
  Another team leader is never listed in Give access and never given it: they decide by the seat
  (#870). A grant they kept from a seat held before becoming team leader can still be removed,
  through Edit access or Remove all access.

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
  department. Holding **"Approve orders"** also opens the page, with no other Orders access
  (#270): a member who holds only that grant sees Orders under TEAM in their sidebar, decides
  waiting orders and marks approved ones as ordered, and edits, cancels and requests nothing.
  A person with no Orders access and no "Approve orders" does not see the page.
- **Who edits.** A division lead edits the orders of their own division, from any requester in
  it, by their role alone: they need no Orders grant, and a grant elsewhere adds only what it
  gives (#590). A department head edits the orders of their whole department. Full access edits every
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
- **What waits on the Overview** (#592). Everyone who decides orders, the team leader and every
  holder of "Approve orders" (a member, a lead, a head or a full-access seat), sees the team
  leader's two rows under "Needs your attention" on their Overview, whatever its shape: "N orders
  wait for your decision" and "N approved orders are not ordered yet", both counted across the
  whole team and both linking to Orders. Nobody else gets either row. Anyone who holds
  "Approve orders", whatever their seat, also sees an "Approve orders" line under "Your access",
  with the count of orders waiting for a decision, linking to Orders (#593). The team leader
  decides by their seat, which is no grant, so they get the rows and no line.
- **Deciding on the page** (#247, boards 70 to 70e). A waiting order opened by someone who decides
  shows Reject, Ask for changes and Approve; if they may also edit it, "Edit order" and "Cancel
  request" move to the panel's head. Everyone who may edit a waiting order gets those same two
  buttons with those same labels, whether they decide it or not (#675). While a panel is open
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

- A preview with a database reads the shared, seeded `preview` branch (ADR 0016), and writes
  made there are kept across preview builds.
  Every page reads a database under `next dev` (the Neon `development` branch) and on a preview
  (the `preview` branch); a run there with no database stops with a message naming the one it
  needs (#609). Both offer the tester sign-in, and any signed-in account uses View as to see the
  dashboard as a plain seat: team leader, operations lead, department head, division lead,
  member, alumni and non-member, among others (#608, #610, #612). The alumni seat is a former member with three years of ended roles, an Alumni entry, one
  application decided within the last month and one decided before it (#317). The operations
  lead there sits in the operations lead's seat, so they have full access and do not decide
  orders; the team leader decides orders and gives "Approve orders" (#247), and sees boards 72 to
  73c (#252).
  Production never does.
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
- On a preview with a database, partner changes are saved to the seeded `preview` branch and
  kept across preview builds (ADR 0016).

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
- On a preview with a database, question changes are saved to the seeded `preview` branch and
  kept across preview builds (ADR 0016).

### Projects page (#297, board 75)

- The Projects page shows every stored project as its home card, drawn as Home draws it, at about
  0.85 scale and three per row from 1024px, in site order. A draft shows its draft.
- Over each card: a drag grip, the status (Published, Draft or Draft changes) and the "edited by"
  line: when the project's versions were last saved and by whom ("Edited 12 Sep by Giulia
  Rossi"). While its draft changes one part of the page only, the line names it ("Launch history
  edited today by Marco Bianchi"). The database side reads it from the audit log; an anonymized
  account names no one. Moving a card is not an edit.
- Under each card: Edit page opens the project on its page (board 75b); View on site opens the
  public page in a new tab, and only a published project has one.
- Dragging a card, or the arrow keys on its grip, sets the site order. It is saved at once, and
  the home Projects section and /projects follow it.
- New project (#301), in the page header, asks for the name, the address and whether it is a
  rocket or an engine. The name is at most 40 characters. The address follows the name until it
  is typed in itself; it is lower-case letters and digits joined by single hyphens, at most 40
  characters, and no other project may hold it in its published version or its draft. The server
  refuses the same.
- Create draft stores the project as a draft at the end of the site order and opens it in the
  editor (board 75b). The draft has a line of starting copy in every section, a brand texture
  picked by its address, and the placeholder rocket on its card and page. No public page shows
  it, and its address has no page, until it is published.
- Only the full admins and holders of a Content grant reach the page or use New project;
  everyone else gets the dashboard's not found.
- On a preview with the seeded `preview` branch, a new order and new projects are saved there
  and kept across preview builds (ADR 0016).

### Project pages (#298 and #299, boards 75b and 75c)

- A project opens on its real page under the shared edit bar ("Projects / Editing <project>"
  and its state, Desktop | Phone, Save draft, Publish). Hovering a block outlines it with its name
  and an Edit chip; the chip opens the "Edit <project>" panel with that section open.
- The page switch (#300, board 75d) on the edit bar: Project page, Home and Projects list. Home
  shows the home Projects section and the Projects list shows /projects, each with this project's
  card drawn from the panel's fields in its place in the site order among the published projects,
  outlined, with an "Edit card" chip; the other cards are dimmed. Edit card opens the panel's Card
  section: the project's name (on the card, the page and the Projects list), the card's year,
  status pill (its text, or for a rocket its flight count, and dark or light), description and
  three specs. The card's number is its place in the site order and is changed only by dragging on
  the Projects page. Save draft and Publish work as for the page: a published card change is on
  Home and /projects. The /projects entry's own copy (years, description, six specs) is not edited
  here.
- The panel's sections: Top of the page (intro, status, dates, the visual's caption, one to six
  key facts), Name story, Design story (with its parts, drawn top to bottom and numbered from the
  bottom), Versions, Launch history (a rocket's only), Plan, Why (one to three reasons) and
  Gallery. The page redraws as the editor types.
- Versions: each version's name, phone tab, what it was for and its spec rows (an empty spec shows
  a dash). Exactly one is highlighted; removing it is refused until another one is.
- Launch history: one card per launch, opened one at a time: name, date, place, version, motor,
  outcome, what happened, four numbers, the line and result the Projects list shows, the country
  (a flight's), an optional award and up to two photos. On a flight the first two numbers are its
  apogee and max speed. The phone card keeps three numbers: a flight keeps its apogee and max
  speed, and Phone picks which other number it leaves out and edits the shorter labels. A shown
  history keeps one launch at least; removing the last one is refused.
- A launch published from here is on the project page, in the /projects log and in the header
  counts (flights, countries, awards), and Cavour's home card counts its flights ("FLOWN ×3"),
  with no code change.
- Plan: each step's status (Done, Under way, Next, Later), an optional date, title and text. The
  page orders them by status. One step is always under way: marking another under way marks the
  old one done, and taking the status off the step under way, or removing it, is refused.
- Gallery: the carousel's photos in order, each with its description for screen readers and an
  optional caption; a placeholder slot stays until it is removed. A shown gallery keeps one photo
  at least.
- Launch and gallery photos upload the moment they are picked, as Outreach photos do: behind the
  site-content gate, to the public store under `project-photos/`. A save refuses a photo this side
  did not upload. A file is deleted once no version of any project shows it and the open editor
  holds it no more: removing a photo or a whole launch deletes its file unless a saved version
  shows it, and a save with Launch history or Gallery off keeps the files of the photos still in
  the panel, so switching the section back on brings them back. Leaving the editor with photos
  that are only in the panel (a section that is off, or an upload not yet saved) leaves their
  files in the store, as Outreach does, until the daily sweep deletes each one a day old that no
  saved content shows (#831). A save refuses an upload more than half a day old that the item did
  not show yet ("Reload the page and add it again"), so the sweep never deletes a file a save is
  keeping.
- Desktop edits the desktop text. Phone edits the phone text of the fields that have one; an empty
  phone field shows the desktop text, except the story texts, which always have their own.
- An optional section (Versions, Launch history, Plan, Why, Gallery) has a show-on-page switch in its header. Off, the section
  leaves the page and the numbers of the sections after it close up. Its text stays in the panel
  while the editor is open, Save draft and Publish included, and switching it back on brings it
  back. The saved page keeps no text for a section that is off, so closing or reloading the
  editor loses it. A section that is off does not stop a save.
- Save draft and Publish refuse an empty field and open its section. Save draft leaves the
  published page as it is; Publish puts the changes on the public page.
- Only the full admins and holders of a Content grant open the editor or save; everyone else
  gets the dashboard's not found.
- On a preview with the seeded `preview` branch, project changes are saved there and kept
  across preview builds (ADR 0016).

### Team page visual layer (#283, epic #259)

- The Team page's edits are one visual layer laid on the page the team's roles build (ADR 0015):
  who a spot shows, the name, role, photo and LinkedIn on the page, hidden people, added leaders,
  department names, hidden and added departments, division leads added, removed or reordered, the
  intro text and the group photo. The team email is never edited.
- An edit is kept to a spot (the team leader, a place on the arc, a head block, a division lead
  row), never to a person or a role. When the real team changes and a spot is gone, its edit stays
  in the layer and the page skips it; it shows again if the spot comes back. Only the editor or
  Reset to team removes an edit.
- An added leader sits at either end of the arc or right after a neighbour, in `OrgChart.leaders`
  reading order. The arc holds at most eight; adding a ninth is refused.
- The layer has a published version and an optional draft. Save draft and Reset to team change
  only the draft; Publish changes what `/about/the-team` shows. Reset to team removes every edit
  except the intro text and the group photo.
- Writes follow the site-content rule, and none writes a role, division, department, scope or
  member.
- On a preview with the seeded `preview` branch (ADR 0016), the public Team page shows the seeded
  published layer and advisors. Layer writes there are saved to the `preview` branch and kept
  across preview builds (ADR 0016).
- The editor (boards 80, 80b and 80h, #284) is "Team page" under Content, at
  `/dashboard/team-page`: the real page under the shared edit shell, with the "Visual changes
  only" tag and Reset to team on the bar. The team leader and each leader on the arc open the Edit
  person panel; the intro text and the group photo are edited in place. A field put back as the
  team record has it is no edit. The core members list and "In numbers" have no edit affordance.
  Replace photo picks a photo the site already holds; the layer takes no upload yet.
- Adding on the page (boards 80e, 80f and 80g, #285): while no panel is open, a "+" sits at each
  place on the arc a leader may be added, both ends and between each pair of neighbours, and the
  stacked chart (below xl and on phones) has one "Add leader" after the last leader. They go at
  eight leaders. The new leader is drawn inline at that place on the arc and in the phone grid,
  keeping the arc's ordering logic (`lib/about/arc-order.ts`); the Add leader panel's Place field
  moves them, and a leader added before opens the same panel with Remove from page. "+ Add
  department" sits beside each departments slide's heading, and "+ Add division lead" on a hovered
  head block. Edit a head block changes the person, role and department name on the page, the
  division leads shown (drag to reorder, edit, remove, add), the photo and LinkedIn; Hide from
  page hides the block (an added department is removed), and Back to the team record puts the
  head, the department's name and its leads back as the roles have them. None of it creates a
  role, department or division.
- Advisors (boards 80c and 80d, #286): faculty and specialists outside the student team, added by
  hand and never built from roles. Each is a content item with a published version and an
  optional draft. On the page the Advisors section is one block, "Advisors · Added by hand", whose
  "Edit advisors" opens the Advisors panel: principal advisors, then specialists, each group
  dragged into its order, and one advisor open at a time (full name, role on the page, Principal
  / Specialist, LinkedIn, email, photo). Add advisor adds one. Add, edit, reorder and Principal /
  Specialist changes are drafts that the edit bar's Save draft keeps and Publish puts on
  `/about/the-team`. Replace photo picks a photo the site already holds. A photo picked from a
  member's own picture is saved as a copy, one for the page's layer and one for each advisor row
  that shows it, so no two rows share one file and replacing the picture never takes the Team
  page's photo with it (Owner decision, #831).
- End advising is the one advisor change made at once, after the editor picks the academic years
  they advised: the advisor leaves the Team page and an Alumni entry in the Advisors group takes
  their name, role, years and a copy of their photo (#831). It writes the advisor tables and that one `alumni_entries`
  row, never a role, division, department, scope or member. Reset to team never changes the
  advisors. On a preview with the seeded `preview` branch, advisor changes and End advising are
  saved there and kept across preview builds (ADR 0016).
