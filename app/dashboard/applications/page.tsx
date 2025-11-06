import { getUserApplications } from "@/app/actions/get-user-applications";
import { ApplicationsTable } from "@/components/applications-table";

export default async function ApplicationsPage() {
  const applications = await getUserApplications();

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl md:text-5xl font-bold text-primary mb-2">
          My Applications
        </h1>
        <p className="text-muted-foreground">
          Track the status of your job applications
        </p>
      </div>

      <ApplicationsTable applications={applications} />
    </div>
  );
}

