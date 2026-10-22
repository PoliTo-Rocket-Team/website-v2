"use client";

import type { MemberAliases } from "@/lib/dashboard/alias-request";
import type { MemberDirectory } from "@/lib/dashboard/team";
import { membersModelOf } from "@/lib/dashboard/members-view";
import { ScopedMembersView } from "./team-members";
import { PageHeader } from "./page-header";

// The Members page. Every role that opens it, the team leader, the operations
// lead, the IT lead, a department head and a division lead, gets one view with
// the same tools (issues #408 and #418, ./team-members.tsx); only their rows
// (the whole team, the department, the division) and the actions their data
// allows differ. Export to Excel is one such action, full access's alone
// (issue #539): `exportable` comes from the same rule the export route checks.
export function MembersView({
  directory,
  aliases,
  editable,
  exportable,
}: {
  directory: MemberDirectory;
  aliases: MemberAliases;
  editable: boolean;
  exportable: boolean;
}) {
  const page = membersModelOf(directory);
  return page === null ? (
    <PageHeader title="Members" intro="" phone="bar" />
  ) : (
    <ScopedMembersView page={page} aliases={aliases} editable={editable} exportable={exportable} />
  );
}
