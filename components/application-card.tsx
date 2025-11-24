"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Applications } from "@/app/actions/types";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { OtherApplications } from "@/components/other-applications";

  //! todo refactor to use a status config object, review needed for visual grouping
export const getStatusConfig = (status: Applications["status"]) => {
  switch (status) {
    case "accepted":
    case "accepted_joined":
      return {
        variant: "default" as const,
        className:
          "bg-green-100 text-green-800 border-green-200 hover:bg-green-200",
        label: status === "accepted" ? "Accepted" : "Joined",
      };
    case "rejected":
    case "not_selected":
      return {
        variant: "destructive" as const,
        className: "bg-red-100 text-red-800 border-red-200 hover:bg-red-200",
        label: status === "rejected" ? "Rejected" : "Not Selected",
      };
    case "rejected_email_to_be_sent":
      return {
        variant: "destructive" as const,
        className:
          "bg-red-50 text-red-700 border-red-300 hover:bg-red-100 animate-pulse",
        label: "Rejection Pending",
      };
    case "interview":
      return {
        variant: "outline" as const,
        className: "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100",
        label: "Interview",
      };
    case "accepted_email_to_be_sent":
      return {
        variant: "secondary" as const,
        className:
          "bg-green-50 text-green-700 border-green-300 hover:bg-green-100 animate-pulse",
        label: "Acceptance Pending",
      };
    case "resigned":
      return {
        variant: "outline" as const,
        className:
          "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100",
        label: "Resigned",
      };
    case "accepted_by_another_team":
      return {
        variant: "outline" as const,
        className:
          "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100",
        label: "Accepted Elsewhere",
      };
    case "received":
    default:
      return {
        variant: "secondary" as const,
        className: "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100",
        label: "Received",
      };
  }
};

export type ApplicationCardProps = {
  application: Applications;
  isOpen: boolean;
  onToggleAccordion: (id: string, isOpen: boolean) => void;
  onChangeStatus?: (id: number, currentStatus: Applications["status"]) => void;
};

export function ApplicationCard({
  application,
  isOpen,
  onToggleAccordion,
  onChangeStatus,
}: ApplicationCardProps) {
  const fullName =
    `${application.user_first_name ?? ""} ${application.user_last_name ?? ""}`.trim() ||
    application.user_email ||
    application.user_id ||
    "Unknown";

  const handleChangeStatus = () => {
    if (onChangeStatus) {
      onChangeStatus(application.id, application.status);
    }
  };


  return (
    //! todo add border color according to status
    <Accordion
      type="multiple"
      value={isOpen ? [application.id.toString()] : []}
      onValueChange={values => {
        const wasOpen = isOpen;
        const isNowOpen = values.includes(application.id.toString());
        if (wasOpen !== isNowOpen) {
          onToggleAccordion(application.id.toString(), isNowOpen);
        }
      }}
      className="rounded-lg shadow-md border"
    >
      <AccordionItem value={application.id.toString()}>
        <AccordionTrigger className="w-full border-b data-[state=closed]:rounded-lg data-[state=open]:rounded-t-lg p-2 md:px-2 md:py-3 hover:bg-secondary bg-clip-padding duration-100 transition-colors">
          <div className="flex flex-col items-start flex-1 gap-2 md:grid w-full md:grid-cols-[2fr_3fr_auto] md:justify-items-start md:items-center select-text">
            <span className="font-semibold text-sm md:text-lg">{fullName}</span>
            <div className="flex flex-col md:items-start">
              <span className="text-sm md:text-base font-medium ">
                {application.position_title || ""}
              </span>
              <span className="text-xs text-muted-foreground ">
                {[application.division, application.department]
                  .filter(Boolean)
                  .join(" • ")}
              </span>
            </div>
            <div className="flex justify-center">
              {(() => {
                const { variant, className, label } = getStatusConfig(
                  application.status
                );
                return (
                  <Badge variant={variant} className={className}>
                    {label}
                  </Badge>
                );
              })()}
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="p-2 md:p-6">
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs md:text-sm">
              <div>
                <span className="font-medium">Applied at: </span>
                {new Date(application.applied_at).toLocaleString("en-GB")}
              </div>
              <div>
                <span className="font-medium">Email: </span>
                {application.user_email ?? ""}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs md:text-sm">
              <div>
                <span className="font-medium">Origin: </span>
                {application.user_origin || "—"}
              </div>
              <div>
                <span className="font-medium">Level of study: </span>
                {application.user_level_of_study || "—"}
              </div>
              <div>
                <span className="font-medium">PoliTo ID: </span>
                {application.user_polito_id || "—"}
              </div>
              <div>
                <span className="font-medium">Program: </span>
                {application.user_program || "—"}
              </div>
            </div>
            {/* //! todo add cloudflare storage here to store cv and mv */}
            <div className="pt-2">
              <h3 className="font-semibold mb-1">Files</h3>
              <ul className="text-sm list-disc pl-5">
                <li>CV: {application.cv_name ?? ""}</li>
                <li>Motivation letter: {application.ml_name ?? ""}</li>
              </ul>
            </div>

            {Array.isArray(application.custom_answers) &&
              application.custom_answers.length > 0 && (
                <div className="pt-2">
                  <ul className="text-sm list-disc pl-5">
                    {application.custom_answers.map((ans: any, idx: number) => (
                      <li key={idx} className="mb-1">
                        <span className="font-medium">{ans.question}</span>{" "}
                        <br />
                        <span>{ans.answer}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <OtherApplications
              otherApplications={application.other_applications || []}
            />
            {application.similar_applications.length > 0 && (
              <OtherApplications
                otherApplications={application.similar_applications || []}
                title="Similar applications"
                comment="This is a list of applications with same name but different email, candidate might be using multiple emails."
              />
            )}
            {/* //! todo create a way to differentiate current applications and past applications */}
            <OtherApplications
              otherApplications={application.other_applications || []}
              title="Previous applications"
              comment="Applications from previous recruitment sessions"
            />

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={handleChangeStatus}>
                Update Status
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
