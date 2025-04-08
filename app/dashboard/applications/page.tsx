"use client";

import { useEffect, useState } from "react";
import { getAllApplications } from "@/app/actions/user/get-applications";
import ApplicationsList from "@/components/applications-list";

type Application = any;

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApplications() {
      try {
        const { applications } = await getAllApplications();
        setApplications(applications);
      } catch (error) {
        console.error("Error fetching applications:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchApplications();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading applications...</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Applications</h1>
      <ApplicationsList applications={applications} />
    </div>
  );
}