"use client";

import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type HierarchicalData = Record<string, any>;

export default function TeamBrowser({ data }: { data: HierarchicalData }) {
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [selectedDivId, setSelectedDivId] = useState<string>("all");

  const currentDept = selectedDeptId ? data[selectedDeptId] : null;

  const displayedMembers = useMemo(() => {
    if (!currentDept) return [];

    if (selectedDivId !== "all" && currentDept.divisions[selectedDivId]) {
      return currentDept.divisions[selectedDivId].members;
    }

    const directMembers = currentDept.direct_members || [];
    const allSubDivisionMembers = Object.values(currentDept.divisions).flatMap(
      (div: any) => div.members
    );
    const combined = [...directMembers, ...allSubDivisionMembers];
    return Array.from(new Map(combined.map((m) => [m.id, m])).values());
  }, [currentDept, selectedDivId]);

  const handleDeptChange = (value: string) => {
    setSelectedDeptId(value);
    setSelectedDivId("all");
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Team Explorer</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Department
            </label>
            <Select onValueChange={handleDeptChange} value={selectedDeptId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Department..." />
              </SelectTrigger>
              <SelectContent>
                {Object.values(data).map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Division
            </label>
            <Select
              onValueChange={setSelectedDivId}
              value={selectedDivId}
              disabled={!selectedDeptId}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Divisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">View All Members</SelectItem>
                {currentDept &&
                  Object.values(currentDept.divisions).map((div: any) => (
                    <SelectItem key={div.id} value={div.id}>
                      {div.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-card text-card-foreground shadow-sm">
        {displayedMembers.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {selectedDeptId
              ? "No members found in this selection."
              : "Please select a department above to view the team."}
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {displayedMembers.map((member: any) => (
              <AccordionItem
                key={member.id}
                value={member.id}
                className="border-b last:border-0"
              >
                <AccordionTrigger className="px-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4 text-left w-full">
                    <Avatar className="h-9 w-9 border">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {member.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1">
                      <span className="font-medium text-foreground">
                        {member.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="w-fit text-[10px] sm:text-xs font-normal"
                      >
                        {member.role_title}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="bg-muted/30 px-6 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Contact
                      </span>
                      <a
                        href={`mailto:${member.email}`}
                        className="block text-primary hover:underline font-medium"
                      >
                        {member.email}
                      </a>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="font-medium text-foreground">
                          Active Member
                        </span>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}
