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
- **Operations lead**: sees the whole team.

An admin column comes later. **Planned**, no issue yet.

| Sidebar item or page | Non-member | Member | Division lead | Department head | Operations lead |
|---|---|---|---|---|---|
| My applications | Yes, only with at least one application | Yes, only with at least one application | Yes, only with at least one application | Yes, only with at least one application | Yes, only with at least one application |
| Overview | No | Yes | Yes | Yes | Yes |
| Team tree | No | Yes | Yes | Yes | Yes |
| Positions | No | No | Own divisions | All divisions in the department, with a division selector | All, plus the site-wide recruitment switch |
| Applications | No | No | Own divisions | All divisions in the department, with a division selector | All |
| Members | No | No | Their divisions | Their divisions | Their divisions |
| Alumni | No ruling yet | No ruling yet | No ruling yet | No ruling yet | No ruling yet |
| Access | No | No | Their divisions | Their divisions | Their divisions |
| Orders | No | No | Their divisions | Their divisions | Their divisions |
| My account | User menu only | No | No | No | No |
| My profile | No | User menu only | User menu only | User menu only | User menu only |
| Sign out | User menu only | User menu only | User menu only | User menu only | User menu only |

- **My applications** shows for everyone, but only when they have at least one application.
- A non-member with no application lands on the My applications empty state, with a
  "See open positions" button (#179).
  - **Gap:** today they get an empty sidebar and a "not found" page. Tracked in #179.
- **Gap:** the operations lead does not reach Access or Orders. Tracked in #200.
- **Overview** is for members, division leads, department heads and the operations lead. A
  non-member gets no Overview.
- **Team tree** is for members and up.
- **Positions** and **Applications**: a division lead sees their own divisions. A department head
  sees all divisions in their department and picks one with a division selector. The operations
  lead sees all of them, plus the site-wide recruitment switch.
  - **Gap:** there is no department head view and no division selector. Tracked in #184.
  - **Gap:** any access grant, even view-only, makes a member act as a division lead on
    applications. Tracked in #160.
- **Members**, **Access** and **Orders** are for division leads and up, scoped to their divisions.
  - **Gap:** a lead of more than one division sees only the first on Members. Tracked in #185.
- **Alumni**: no ruling yet says who sees this page. Today the code shows it to the operations
  lead only, for the whole team.
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

### Other rules

- Leads see an applicant's other applications and their progress.
- Withdraw is confirmed. The lead stops seeing the application at once. Its files are deleted 30
  days later; the page does not say so. The person can apply again while the role is open.
  - **Gap:** nothing deletes the files after 30 days. Tracked in #178.
- Documents: a CV always, and a motivation letter when the position asks for one. Each file is a
  PDF of at most 2 MB.

## 3. People

- The role on the member panel is the person's title on the Team page.
  - **Gap:** the title saved on the panel never reaches the public Team page. Tracked in #189.
- Promote is confirmed. The lead picks "lead together" or "hand over the division". The department
  head is told.
  - **Gap:** nothing tells the department head. Tracked in #188.
- Move to alumni is confirmed, with the years and an optional reason. Access ends; the account
  stays.
- Leave the team (by the member) is confirmed, with an optional reason. The lead and the
  recruitment manager are told. The person moves to Alumni.
  - **Gap:** nobody is told, and the person keeps member access. Tracked in #178 and #194.
- Delete account: the person types DELETE. It closes the sign-in. The data is kept at least one
  year, then anonymized for statistics. The Privacy Policy must say so (#122). A non-member may
  also withdraw their open applications in the same dialog.
  - **Gap:** nothing anonymizes the data after the year. Tracked in #191.
- Access is given only on the Access page. You can give only what you have, and only inside your
  scope.

## 4. Orders

- The statuses are Waiting, Approved, Changes requested and Rejected.
- On Changes requested, the team leader's reason shows, with "Edit and send again".
- A lead can cancel a request while it is waiting.

## 5. Data and testing

- Previews, and `next dev` without a database, run on dummy data. They offer the "Sign in as test
  developer" switch, with four people: non-member, member, division lead and operations lead.
  Production never does.
- On a phone, popups become bottom sheets, side panels become full pages with a back arrow, and
  tables become stacked cards.
