import { Suspense } from "react";
import { getApplicationsByMemberScope } from "@/app/actions/get-applications";
import { ApplicationsList } from "@/components/applications-list";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Applications } from "@/app/actions/types";

async function ApplicationsContent() {
  const { applications } = await getApplicationsByMemberScope();

  return <ApplicationsList applications={applications as Applications[]} />;
}

function ApplicationsListFallback() {
  return (
    <div className="w-full relative max-w-5xl mx-auto">
      <LoadingSkeleton className="space-y-2 md:space-y-4" />
    </div>
  );
}

export default function ApplicationsPage() {
  //! todo handle no access with sessi

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
      <Suspense fallback={<ApplicationsListFallback />}>
        <ApplicationsContent />
      </Suspense>
    </div>
  );
}
