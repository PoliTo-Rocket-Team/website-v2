"use client";

import type { MemberDirectory } from "@/lib/dashboard/team";
import { membersModelOf } from "@/lib/dashboard/members-view";
import { ScopedMembersView } from "./team-members";
import { PageHeader } from "./page-header";

// The Members page. Every role that opens it, the team leader, the operations
// lead, the IT lead, a department head and a division lead, gets one view with
// the same tools (issues #408 and #418, ./team-members.tsx); only their rows
// (the whole team, the department, the division) and the actions their data
// allows differ.
export function MembersView({ directory, editable }: { directory: MemberDirectory; editable: boolean }) {
  const page = membersModelOf(directory);
  return page === null ? <PageHeader title="Members" intro="" phone="bar" /> : <ScopedMembersView page={page} editable={editable} />;
}
