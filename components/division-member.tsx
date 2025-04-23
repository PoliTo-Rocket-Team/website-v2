"use client";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { CardContent, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import team_meta_data from "@/app/actions/user/member";
import { Member } from "@/types/team-member-data";

interface DivisionMembersProps {
  divisionMembers: Member[];
  divID: number;
}

export default function DivisionMembers({
  divisionMembers,
  divID,
}: DivisionMembersProps) {
  return (
    <Accordion
      className="
    w-full
    "
      type="single"
      collapsible
    >
      {divisionMembers
        .filter((member: Member) => member.division_id === divID)
        .map((member: Member, index) => (
          <AccordionItem
            key={member.member_id}
            value={`item-${member.member_id}`}
          >
            <AccordionTrigger className="flex items-center w-full p-4 border rounded-md shadow-sm m-[20px]">
              <div className="flex items-center gap-4 w-full justify-between">
                <div className="flex items-center gap-4 ">
                  <UserAvatar
                    user={{
                      name: `${member.first_name} ${member.last_name}`,
                      image: "",
                      email: member.email || "",
                    }}
                  />
                  <div className="flex items-center w-full justify-between gap-4">
                    <CardTitle
                      className=" 
                      text-base
                        sm:text-xl
                        md:text-2xl  
                        lg:text-3xl  
                        xl:text-3xl  
                        2xl:text-3xl  "
                    >
                      {member.first_name + " "} {member.last_name}
                    </CardTitle>
                    <div className="text-l text-muted-foreground">
                      {member.role_title || "No role assigned"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 hidden md:flex">
                  <span className="text-sm border rounded p-1 ">
                    {member.departments_name}
                  </span>

                  <span className="text-sm border rounded p-1">
                    {member.division_code}
                  </span>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="flex flex-col items-center justify-center ">
              <CardContent className="py-[7px]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-sm">
                    <span className="font-medium">Email:</span>{" "}
                    {member.email || "N/A"}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Discord:</span>{" "}
                    {member.discord || "N/A"}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Mobile Number:</span>{" "}
                    {member.mobile_number || "N/A"}
                  </div>
                  {/* <div className="text-sm">
                    <span className="font-medium">NDA Name:</span>{" "}
                    {member.nda_name || "N/A"}
                  </div> */}
                  {/* <div className="text-sm">
                    <span className="font-medium">NDA Signed At:</span>{" "}
                    {member.nda_signed_at || "N/A"}
                  </div> */}
                  <div className="text-sm">
                    <span className="font-medium">Level of Study:</span>{" "}
                    {member.level_of_study || "N/A"}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">LinkedIn:</span>{" "}
                    {member.linkedin || "N/A"}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Origin:</span>{" "}
                    {member.origin || "N/A"}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Polito ID:</span>{" "}
                    {member.polito_id || "N/A"}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Program:</span>{" "}
                    {member.program || "N/A"}
                  </div>
                  {/* <div className="text-sm">
                    <span className="font-medium">Updated At:</span>{" "}
                    {member.users?.[0]?.updated_at || "N/A"}
                  </div> */}

                  <div className="text-sm">
                    <span className="font-medium">Subteam:</span>{" "}
                    {member.departments_name || ""}
                  </div>

                  <div className="text-sm">
                    <span className="font-medium">Division Code:</span>{" "}
                    {member.division_code}
                  </div>
                </div>
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        ))}
    </Accordion>
  );
}
