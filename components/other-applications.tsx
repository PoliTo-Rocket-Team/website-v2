"use client";

import { Badge } from "@/components/ui/badge";
import { OtherApplication } from "@/app/actions/types";
import { getStatusConfig } from "./application-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

type OtherApplicationsProps = {
  otherApplications: OtherApplication[];
  title?: string;
  comment?: string;
  className?: string;
};

export function OtherApplications({
  otherApplications,
  title = "Other applications",
  comment = "",
  className,
}: OtherApplicationsProps) {
  if (otherApplications.length === 0) {
    return (
      <div className="">
        <h3 className="font-semibold pt-4 pb-1 border-b border-border">
          {title} (0)
        </h3>
        {comment && (
          <div className="text-xs pt-3 pb-1 pl-2 text-muted-foreground">
            {comment}
          </div>
        )}
        <div className="text-sm pt-3 text-muted-foreground">
          This candidate doesn't have other applications.
        </div>
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="applications" className="border-none m-0">
          <AccordionTrigger className="font-semibold hover:no-underline  pb-1 border-b border-border">
            {title} ({otherApplications.length})
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-0">
            {comment && (
              <div className="text-xs pb-1 pl-2 text-muted-foreground">
                {comment}
              </div>
            )}
            <div className="space-y-2">
              {otherApplications.map(app => (
                <div
                  key={app.id}
                  className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 border rounded-md bg-muted/30 text-xs"
                >
                  {/* Position & Organization */}
                  <div className="space-y-2">
                    <div className="font-medium text-sm">
                      {app.position_title}
                    </div>
                    <div className="text-muted-foreground ">
                      <span className="font-medium">Division:</span>{" "}
                      {app.division}
                      {app.department && (
                        <>
                          <br />
                          <span className="font-medium">Department:</span>{" "}
                          {app.department}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Lead & Date */}
                  <div className="flex flex-col justify-start space-y-2">
                    <div className="font-medium text-sm text-transparent">
                      &nbsp;
                    </div>
                    <div className="">
                      {app.division_lead_name && (
                        <div className="text-muted-foreground">
                          <span className="font-medium">Division Lead:</span>{" "}
                          {app.division_lead_name}
                        </div>
                      )}
                      <div className="text-muted-foreground">
                        <span className="font-medium">Applied at:</span>{" "}
                        {new Date(app.applied_at).toLocaleString("en-GB")}
                      </div>
                    </div>
                  </div>

                  {/* Applicant Info */}
                  <div className="flex flex-col justify-start space-y-2">
                    <div className="font-medium text-sm text-transparent hidden md:block">
                      &nbsp;
                    </div>
                    <div className="">
                      {app.user_email && (
                        <>
                          <div className="text-muted-foreground">
                            <span className="font-medium">Name:</span>{" "}
                            {app.user_first_name} {app.user_last_name}
                          </div>
                          <div className="text-muted-foreground break-all">
                            <span className="font-medium">Email:</span>{" "}
                            {app.user_email}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  {/* //! todo fix status badge */}
                  {/* {(() => {
                    const { variant, className, label } = getStatusConfig(
                      app.status
                    );
                    return (
                      <Badge variant={variant} className={className}>
                        {label}
                      </Badge>
                    );
                  })()} */}
                  <div className="flex items-center justify-center md:justify-end">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
