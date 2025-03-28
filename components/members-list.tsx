"use client";

import { useState, useEffect } from "react";
import {
  getMembersByUserRole,
  Member,
  Role,
} from "@/app/actions/user/get-members";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { CardContent, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";

export function MembersList() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [userRole, setUserRole] = useState<Partial<Role>[] | null>(null);

  useEffect(() => {
    const loadMembers = async () => {
      setLoading(true);
      const { members, role } = await getMembersByUserRole();
      setMembers(members);
      setUserRole(role);
      setLoading(false);
    };

    loadMembers();
  }, []);

  if (loading) {
    return <div>Loading members...</div>;
  }

  if (!userRole) {
    return <div>You don't have any assigned role</div>;
  }

  // Group members by division
  const membersByDivision: Record<string, Member[]> = {};

  members.forEach((member) => {
    const divisionName = member.roles?.[0]?.divisions?.name || "Other";
    if (!membersByDivision[divisionName]) {
      membersByDivision[divisionName] = [];
    }
    membersByDivision[divisionName].push(member);
  });

  return (
    <div className="space-y-4">
      {Object.entries(membersByDivision).map(([divisionName, divisionMembers]) => (
        <Accordion key={divisionName} type="single" collapsible className="mb-4">
          <AccordionItem value={divisionName}>
            <AccordionTrigger className="font-semibold text-lg">
              {divisionName} ({divisionMembers[0]?.roles?.[0]?.divisions?.code || "No Code"})
            </AccordionTrigger>
            <AccordionContent>
              <Accordion type="single" collapsible>
                {divisionMembers.map((member, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="flex items-center w-full p-4 border rounded-md shadow-sm">
                      <div className="flex items-center gap-4 w-full justify-between">
                        <div className="flex items-center gap-4">
                          <UserAvatar
                            user={{
                              name: `${member.users?.[0]?.first_name || ""} ${
                                member.users?.[0]?.last_name || ""
                              }`,
                              image: "",
                              email: member.users?.[0]?.email || member.prt_email || "",
                            }}
                          />
                          <div className="flex items-center w-full justify-between gap-4">
                            <CardTitle className="">
                              {member.users?.[0]?.first_name} {member.users?.[0]?.last_name}
                            </CardTitle>
                            <div className="text-l text-muted-foreground">
                              {member.roles?.[0]?.title || "No role assigned"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.roles?.[0]?.subteams &&
                            member.roles?.[0]?.subteams?.name && (
                              <span className="text-sm border rounded p-1">
                                {member.roles?.[0]?.subteams.name}
                              </span>
                            )}
                          {member.roles?.[0]?.divisions?.code && (
                            <span className="text-sm border rounded p-1">
                              {member.roles?.[0]?.divisions?.code}
                            </span>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-sm">
                            <span className="font-medium">Email:</span>{" "}
                            {member.users?.[0]?.email || member.prt_email || "N/A"}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Discord:</span> {member.discord || "N/A"}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Mobile Number:</span>{" "}
                            {member.mobile_number || "N/A"}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">NDA Name:</span> {member.nda_name || "N/A"}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">NDA Signed At:</span>{" "}
                            {member.nda_signed_at || "N/A"}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Level of Study:</span>{" "}
                            {member.users?.[0]?.level_of_study || "N/A"}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">LinkedIn:</span>{" "}
                            {member.users?.[0]?.linkedin || "N/A"}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Origin:</span>{" "}
                            {member.users?.[0]?.origin || "N/A"}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Polito ID:</span>{" "}
                            {member.users?.[0]?.polito_id || "N/A"}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Program:</span>{" "}
                            {member.users?.[0]?.program || "N/A"}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Updated At:</span>{" "}
                            {member.users?.[0]?.updated_at || "N/A"}
                          </div>
                          {member.roles?.[0]?.subteams?.name && (
                            <div className="text-sm">
                              <span className="font-medium">Subteam:</span>{" "}
                              {member.roles[0].subteams.name}
                            </div>
                          )}
                          {member.roles?.[0]?.divisions?.code && (
                            <div className="text-sm">
                              <span className="font-medium">Division Code:</span>{" "}
                              {member.roles[0].divisions.code}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ))}
    </div>
  );
}