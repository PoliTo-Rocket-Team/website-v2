---
id: 0010
title: "Uploads live in two Vercel Blob stores, private for applications and orders and public for photos, with application PDFs at most 2 MB"
status: accepted
date: 2026-10-10
tags: [storage, uploads, vercel-blob, recruitment]
---

# 0010 — Uploads live in two Vercel Blob stores, private for applications and orders and public for photos, with application PDFs at most 2 MB

**What this decides:** Uploaded files go to Vercel Blob. Application files and order quotes go to a private store; profile photos go to a public store. An application PDF is at most 2 MB. The recruitment manager downloads and clears the application files each recruitment round.

## Context

Decided 2026-10-10 by the project owner. Approval: https://github.com/PoliTo-Rocket-Team/website-v2/issues/181#issuecomment-6095711336. The rule texts are in the original report of issue #181. The stores were built in issues #127 and #133.

Who may open which file in the dashboard is in the dashboard rules doc, [docs/dashboard-rules.md](../docs/dashboard-rules.md) (issue #180), and is not copied here.

## Decision

**Uploads live in Vercel Blob: a private store for `applications/` and `orders/`, a public store for `photos/`; application PDFs are at most 2 MB; the recruitment manager downloads and clears the files each round.**

1. **Private store.** Holds application files under `applications/` and order files under `orders/`. They are served only through an access-checked route, never by a public URL.
2. **Public store.** Holds profile photos under `photos/`, served from their public URL.
3. **Application PDFs are at most 2 MB.**
4. **Each recruitment round,** the recruitment manager downloads the application files and then clears them.

**Binding constraints.**
- Never put an application file or an order file in the public store.
- Never raise the 2 MB limit on application PDFs without a new ruling.

## Consequences

- Applicants' files never have a public link.
- Files do not pile up across rounds, once the per-round clearing exists.

## Gaps

None.

Followed today: the prefixes are fixed in [lib/storage/pathname.ts](../lib/storage/pathname.ts); [lib/storage/private-store.ts](../lib/storage/private-store.ts) uses `access: "private"` and [lib/storage/public-store.ts](../lib/storage/public-store.ts) uses `access: "public"`; `MAX_PDF_BYTES = 2 * 1024 * 1024` in [lib/apply/application-form.ts](../lib/apply/application-form.ts) is checked on the server when an application is sent.

## Amendment, 2026-10-25

Owner decision, 2026-10-25, on issue #194 (https://github.com/PoliTo-Rocket-Team/website-v2/issues/194#issuecomment-6396512295): downloading and clearing each round's application files is not needed and is dropped. Decision 4 and the last clause of the bold summary ("the recruitment manager downloads and clears the files each round") no longer hold, and the second Consequence ("Files do not pile up across rounds, once the per-round clearing exists") is withdrawn with them; those lines stay as written. Application files are still deleted 30 days after the application is withdrawn ([0011](0011-applicant-journey-received-to-joining.md) rule 8), and when a person deletes their account with the box ticked. The recruitment manager is the Logistics lead ([0011](0011-applicant-journey-received-to-joining.md), amendment of 2026-10-25). The rest of this record is unchanged.

## Records

no vocabulary impact
