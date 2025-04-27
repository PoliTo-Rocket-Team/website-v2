"use client";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Dept } from "@/app/actions/user/get-dept";
import { Button } from "./ui/button";
import CustomAlertDialog from "./custom-alert-dialog";

export function DeptList({ depts }: { depts: { dept: Dept[] } }) {
  return (
    <Accordion type="single" collapsible className=" w-full">
      {depts.dept.map(department => (
        <AccordionItem
          className="border my-4 items-center px-4 rounded-md shadow-sm"
          key={department.id}
          value={department.id.toString()}
        >
          <AccordionTrigger>
            <div className="flex justify-between items-center w-full mx-2">
              <div>
                {department.name} ({department.code})
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {Array.isArray(department.divisions) &&
            department.divisions.length > 0 ? (
              <Accordion type="single" collapsible className="mx-5">
                {department.divisions.map(division => (
                  <AccordionItem
                    key={division.id}
                    value={division.id.toString()}
                    className="border my-4 items-center px-4 rounded-md shadow-sm"
                  >
                    <AccordionTrigger>
                      {division.name} ({division.code})
                    </AccordionTrigger>
                    <AccordionContent>
                      <p>Started at: {division.started_at}</p>
                      <p>Closed at: {division.closed_at}</p>
                      <div className="flex justify-center items-center w-full">
                        <CustomAlertDialog
                          destructiveButton="Close"
                          value={division}
                        />
                        <Button>Edit</Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <p>No divisions available</p>
            )}
            <div className="flex justify-center items-center w-full">
              <CustomAlertDialog destructiveButton="Close" value={department} />
              <Button>Edit</Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
