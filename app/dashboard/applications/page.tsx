import { getApplicationsByUserRole } from "@/app/actions/user/get-applications";
import { ApplicationsList } from "@/components/applications-list";

export default async function ApplicationsPage() {
  const { applications = [], role = null } = await getApplicationsByUserRole();
  
  return (
    <div>
      <div className="w-full">
        <div className="flex justify-between px-4 text-foreground">
          <h1 className="text-2xl font-bold">Applications</h1>
          <div className="px-2 py-1 text-sm rounded-full border border-gray-200">
            {role || "User"}
          </div>
        </div>
        <ApplicationsList applications={applications} userRole={role} />
      </div>
    </div>
  );
}