"use client";

import { UserApplication } from "@/app/actions/get-user-applications";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import Link from "next/link";

type ApplicationsTableProps = {
  applications: UserApplication[];
};

const statusConfig = {
  pending: {
    label: "Pending Review",
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  },
  received: {
    label: "Received",
    className: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  },
  accepted: {
    label: "Accepted",
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-800 hover:bg-red-100",
  },
  accepted_by_another_team: {
    label: "Accepted by Another Team",
    className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  },
};

export function ApplicationsTable({ applications }: ApplicationsTableProps) {
  if (applications.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <p className="text-muted-foreground text-lg mb-2">
          No applications yet
        </p>
        <p className="text-sm text-muted-foreground">
          Visit the{" "}
          <Link href="/apply" className="text-orange-500 underline hover:text-orange-600">
            apply page
          </Link>{" "}
          to find open positions
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Mobile view */}
      <div className="md:hidden">
        {applications.map((application) => (
          <div
            key={application.id}
            className="border-b last:border-b-0 p-4 space-y-3"
          >
            <div>
              <h3 className="font-semibold text-lg">{application.position.title}</h3>
              <p className="text-sm text-muted-foreground">
                {application.position.dept_name} · {application.position.div_name}
              </p>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {format(new Date(application.applied_at), "MMM dd, yyyy")}
              </span>
              <Badge className={statusConfig[application.status].className}>
                {statusConfig[application.status].label}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop view */}
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Position</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Division</TableHead>
            <TableHead>Applied Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((application) => (
            <TableRow key={application.id}>
              <TableCell className="font-medium">
                {application.position.title}
              </TableCell>
              <TableCell>{application.position.dept_name}</TableCell>
              <TableCell>{application.position.div_name}</TableCell>
              <TableCell>
                {format(new Date(application.applied_at), "MMM dd, yyyy")}
              </TableCell>
              <TableCell>
                <Badge className={statusConfig[application.status].className}>
                  {statusConfig[application.status].label}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

