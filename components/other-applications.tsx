"use client";

import { Badge } from "@/components/ui/badge";
import { OtherApplication } from "@/app/actions/types";

type OtherApplicationsProps = {
  otherApplications: OtherApplication[];
  title?: string;
  comment?: string;
};

export function OtherApplications({
  otherApplications,
  title = "Other applications",
  comment = "",
}: OtherApplicationsProps) {
  if (otherApplications.length === 0) {
    return (
      <div className="pt-2">
        <h3 className="font-semibold mb-2">{title}</h3>
        <div className="text-sm text-muted-foreground">
          This candidate has not applied to any other positions in the team.
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <h3 className="font-semibold">
        {title} ({otherApplications.length})
      </h3>
      <div className="text-xs p-2 text-muted-foreground">
          {comment}
        </div>
      <div className="space-y-2">
        {otherApplications.map(app => (
          <div
            key={app.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md bg-muted/30"
          >
            <div className="flex-1">
              <div className="font-medium text-sm">{app.position_title}</div>
              <div className="text-xs text-muted-foreground">
                {[app.division, app.department].filter(Boolean).join(" • ")}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Applied: {new Date(app.applied_at).toLocaleString("en-GB")}
              </div>
            </div>
            <div className="mt-2 sm:mt-0 sm:ml-4">
              <Badge
                variant={
                  app.status === "accepted"
                    ? "default"
                    : app.status === "rejected"
                      ? "destructive"
                      : "secondary"
                }
                className="text-xs"
              >
                {app.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
