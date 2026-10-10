---
id: 0008
title: "Sign-in is Google only and the site never sends email; the UI tells the actor to email people instead"
status: accepted
date: 2026-10-10
tags: [auth, sign-in, email]
---

# 0008 — Sign-in is Google only and the site never sends email; the UI tells the actor to email people instead

**What this decides:** People sign in with Google and nothing else; there is no email and password. The site has no email service and never sends an email. When someone must be told something, the page tells the person acting to email them.

## Context

Decided 2026-10-10 by the project owner. Approval: https://github.com/PoliTo-Rocket-Team/website-v2/issues/181#issuecomment-6095711336. The rule texts are in the original report of issue #181. Issue #118 removed email and password sign-in.

[0002](./0002-vercel-hobby-host-agnostic.md) says email sending goes through a swappable provider. This record amends that part: the site sends no email, so there is nothing for that constraint to govern while this record stands. The rest of 0002 still holds.

Who may do what in the dashboard is in the dashboard rules doc, [docs/dashboard-rules.md](../docs/dashboard-rules.md) (issue #180), and is not copied here.

## Decision

**Sign-in is Google only, the site never sends email, and where someone must be told, the UI tells the actor to email them.**

1. **Google is the only sign-in.** No email and password, so no verification or reset emails. The test developer and the local seeded testers of [0009](./0009-previews-and-dev-use-dummy-data.md) are review tools that production never offers, not sign-ins.
2. **The site has no email service.** No code sends an email.
3. **The actor sends the email.** Where a person must be told something (an interview offer, the NDA, a rejection after acceptance), the page tells the person acting to email them, and gives them what they need to do it.

**Binding constraints.**
- Do not add an email and password sign-in, or any other sign-in provider, without a new ruling.
- Do not add an email provider, SMTP setup or mail library to send mail from the site.
- Copy must not say the site sends a message it does not send.

## Consequences

- No mail service to run, pay for or secure.
- Leads and the team leader do more by hand: they send the emails the site prompts.

## Gaps

- The email tooling from before is still in the repo (`nodemailer`, the Mailpit scripts and folder), though no code uses it: #196.
- The Leave the team copy says the division lead and the recruitment manager "get a message", and nothing sends one: #178 (item 2).

Followed today: `lib/auth.ts` configures only `socialProviders.google`, and no code sends mail.

## Records

No new term. The "Better Auth user" row in [.glossary/TERMS.md](../.glossary/TERMS.md) is corrected to Google-only sign-in.
