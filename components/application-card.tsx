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
          <div className="flex flex-col items-start flex-1 gap-2 md:grid w-full md:grid-cols-[2fr_3fr_auto] md:justify-items-start md:items-center">
            <span className="font-semibold text-sm md:text-lg">{fullName}</span>
            <div className="flex flex-col md:items-start">
              <span className="text-sm md:text-base font-medium">
                {application.position_title || ""}
              </span>
              <span className="text-xs text-muted-foreground">
                {[application.division, application.department]
                  .filter(Boolean)
                  .join(" • ")}
              </span>
            </div>
            <div className="flex justify-center">
              <Badge
                variant={
                  application.status === "accepted"
                    ? "default"
                    : application.status === "rejected"
                      ? "destructive"
                      : "secondary"
                }
              >
                {application.status}
              </Badge>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="p-2 md:p-6">
          <div className="space-y-4">
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
                  <h3 className="font-semibold mb-1">Custom Answers</h3>
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
                comment="This is a list of applications to positions with similar name but different email, candidate might be using multiple emails."
              />
            )}
            <OtherApplications
              otherApplications={application.other_applications || []}
              title="Last applications"
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
