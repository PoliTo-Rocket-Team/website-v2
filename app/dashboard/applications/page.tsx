"use client";

import { useEffect, useState } from "react";
import { getApplicationsByUserRole } from "@/app/actions/user/get-applications";
import { getUserRole, UserRoleInfo } from "@/app/actions/user/get-user-role";
import ApplicationsList from "@/components/applications-list";

type Application = any;

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [userRoleInfo, setUserRoleInfo] = useState<UserRoleInfo>({
    highestRole: null,
    isPresident: false,
    isChief: false,
    isCoordinator: false,
    isLead: false,
    isCoreOrUser: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [appsResult, roleResult] = await Promise.all([
          getApplicationsByUserRole(),
          getUserRole()
        ]);
        
        setApplications(appsResult.applications);
        setUserRoleInfo(roleResult);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading applications...</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Applications</h1>
      <ApplicationsList 
        applications={applications} 
        userRoleInfo={userRoleInfo} 
      />
    </div>
  );
}