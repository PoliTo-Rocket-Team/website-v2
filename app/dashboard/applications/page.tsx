"use server";

import { getApplicationsByMemberScope } from "@/app/actions/get-applications";
import { ApplicationsList } from "@/components/applications-list";
import { Applications } from "@/app/actions/types";

export default async function ApplicationsPage() {
  const { applications } = await getApplicationsByMemberScope();

  return (
    <div className="w-full">
      <div className="flex flex-col my-4 border-b pb-4 md:pb-8">
        <h2 className="text-lg md:text-2xl font-bold text-primary pb-2 md:pb-4">
          Applications
        </h2>
        <p className="text-muted-foreground w-3/4">
          Review and manage candidate applications for your division. You can
          view applicant details and update their status throughout the
          recruitment process.
        </p>
      </div>
      <ApplicationsList applications={applications as Applications[]} />
    </div>
  );
}
