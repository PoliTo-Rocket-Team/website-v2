"use client";

import { useEffect, useState } from "react";
import { Applications } from "@/app/actions/types";
import { ApplicationCard } from "@/components/application-card";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";

type Props = {
  applications: Applications[];
  pageContext?: string;
  onChangeStatus?: (id: number, currentStatus: Applications["status"]) => void;
};

export function ApplicationsList({
  applications: initialApplications,
  pageContext = "applications",
  onChangeStatus,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<Applications[]>([]);
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Sort by applied_at desc by default
    const sorted = [...initialApplications].sort(
      (a, b) =>
        new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
    );
    setApplications(sorted);
    setLoading(false);
  }, [initialApplications]);

  const toggleAccordion = (id: string, isOpen: boolean) => {
    setOpenAccordions(prev => {
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const isAccordionOpen = (id: string) => openAccordions.has(id);

  if (loading) return <LoadingSkeleton className="max-w-5xl mx-auto" />;

  return (
    <div className="w-full relative max-w-5xl mx-auto px-2">
      {!applications.length ? (
        <div className="text-muted-foreground p-4">
          There is no application at the moment.
        </div>
      ) : (
        <div>
          <div className="hidden md:visible md:grid md:grid-cols-[2fr_3fr_auto_auto] text-center md:justify-items-start text-base px-2 py-4">
            <h3>Name</h3>
            <h3>Position</h3>
            <h3 className="px-2.5">Status</h3>
            <Button className="invisible h-4 w-4"></Button>
          </div>
          <div className="space-y-2 md:space-y-4">
            {applications.map(app => (
              <ApplicationCard
                key={app.id}
                application={app}
                isOpen={isAccordionOpen(app.id.toString())}
                onToggleAccordion={toggleAccordion}
                onChangeStatus={onChangeStatus}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
