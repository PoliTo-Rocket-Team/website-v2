'use server'
import { getApplicationsByUserRole } from "@/app/actions/user/get-applications";
import ApplicationsList from "@/components/applications-list";

export default async function ApplicationsPage() {
  
  const { applications, userRoleInfo } = await getApplicationsByUserRole();
  
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Applications</h1>
      {applications.length > 0 ? (
        <ApplicationsList
          applications={applications}
          userRoleInfo={userRoleInfo}
        />
      ) : (
        <div className="p-8 text-center">No applications found</div>
      )}
    </div>
  );
}