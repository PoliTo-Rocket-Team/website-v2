"use client";
import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useTransition } from "react";
import { changeApplicationStatus } from "@/app/actions/user/change-application-status";
import { createClient } from "@/utils/supabase/client";

export function ApplicationsList({ 
  applications: initialApplications, 
  userRole 
}: { 
  applications: any[];
  userRole: string | null;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [alert, setAlert] = useState<{
    message: string;
    type: "success" | "error" | null;
  }>({ message: "", type: null });
  
  // updated in real-time
  const [applications, setApplications] = useState(initialApplications);
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, string>>({});
  
  const supabase = createClient();
  
  // real-time
  useEffect(() => {
    setApplications(initialApplications);
    const channel = supabase
      .channel('application-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
        },
        async (payload) => {
          console.log('Real-time update received:', payload);
          if (payload.eventType === 'INSERT') {
            const { data: newApplication } = await supabase
              .from('applications')
              .select(`
                *,
                user:user_id(id, first_name, last_name),
                position:open_position_id(
                  id, 
                  title,
                  division:division_id(id, name)
                )
              `)
              .eq('id', payload.new.id)
              .single();
              
            if (newApplication) {
              setApplications(prev => [newApplication, ...prev]);
            }
          }
          else if (payload.eventType === 'UPDATE') {
            setApplications(prev => 
              prev.map(app => 
                app.id === payload.new.id 
                  ? { ...app, ...payload.new } 
                  : app
              )
            );
          }
          else if (payload.eventType === 'DELETE') {
            setApplications(prev => 
              prev.filter(app => app.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialApplications]);
  const filteredApplications = applications?.filter(app => 
    statusFilter === "all" ? true : app?.status === statusFilter
  ) || [];
  
  const canEdit = userRole === "president" || userRole === "head" || userRole === "lead";
  
  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown date";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return "Unknown date";
    }
  };

  const handleStatusSelect = (applicationId: string, status: string) => {
    setSelectedStatuses(prev => ({
      ...prev,
      [applicationId]: status
    }));
  };

  const handleStatusSubmit = (applicationId: string) => {
    const newStatus = selectedStatuses[applicationId];

    if (!newStatus) {
      setAlert({
        message: "Please select a status first",
        type: "error"
      });
      setTimeout(() => setAlert({ message: "", type: null }), 1000);
      return;
    }
    
    startTransition(async () => {
      const result = await changeApplicationStatus(applicationId, newStatus);
      
      if (result.success) {
        setAlert({
          message: "Application status updated successfully",
          type: "success"
        });
        
        setTimeout(() => setAlert({ message: "", type: null }), 1000);
      } else {
        setAlert({
          message: result.error || "Failed to update application status",
          type: "error"
        });
        setTimeout(() => setAlert({ message: "", type: null }), 1000);
      }
    });
  };
  
  return (
    <div className="px-4 py-4 relative">
      {filteredApplications.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No applications found
        </Card>
      ) : (
        <>
          <div className="mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Applications</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="accepted_by_another_team">Accepted by Another Team</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Accordion type="single" collapsible className="w-full">
            {filteredApplications.map(application => (
              <AccordionItem
                key={application.id}
                value={application.id.toString()}
                className="border my-4 px-4 rounded-md shadow-sm"
              >
                <AccordionTrigger>
                  <div className="flex justify-between items-center w-full mx-2">
                    <div>
                      Application #{typeof application.id === 'string' ? application.id.substring(0, 8) : application.id}
                      {application.user && application.position && application.position.division && (
                        <span> - {application.user.first_name} applied to {application.position.division.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusClass(application?.status || '')}>
                        {application?.status || 'Unknown'}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {formatDate(application.applied_at)}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {application.cv_name && (
                        <div>
                          <span className="font-medium">CV: </span>
                          {application.cv_name}
                        </div>
                      )}
                      
                      {application.ml_name && (
                        <div>
                          <span className="font-medium">Motivation Letter: </span>
                          {application.ml_name}
                        </div>
                      )}
                    </div>
                    
                    {application?.custom_answers && Array.isArray(application.custom_answers) && application.custom_answers.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Questionnaire</h4>
                        <Accordion type="single" collapsible className="mx-2">
                          {application.custom_answers.map((qa: any, index: number) => (
                            <AccordionItem
                              key={index}
                              value={`question-${index}`}
                              className="border my-2 px-2 rounded"
                            >
                              <AccordionTrigger className="text-sm">
                                {qa?.question || 'Question'}
                              </AccordionTrigger>
                              <AccordionContent className="text-sm">
                                {qa?.answer || 'No answer provided'}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    )}
                    
                    {canEdit && (
                      <div className="flex justify-center items-center w-full gap-4 pt-4">
                        <Select 
                          defaultValue={application.status}
                          onValueChange={(value) => handleStatusSelect(application.id, value)}
                        >
                          <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Change status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="received">Received</SelectItem>
                            <SelectItem value="accepted_by_another_team">Accepted by Another Team</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="default"
                          disabled={isPending}
                          onClick={() => handleStatusSubmit(application.id)}
                        >
                          {isPending ? 'Updating...' : 'Submit'}
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          
          {alert.type && (
            <div className="fixed bottom-4 right-4 z-50 max-w-md shadow-lg rounded-lg overflow-hidden transition-all duration-300 transform translate-y-0">
              <Alert className={`${alert.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                <AlertDescription>
                  {alert.message}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getStatusClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    case "rejected":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    case "accepted":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "received":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "accepted_by_another_team":
      return "bg-purple-100 text-purple-800 hover:bg-purple-100";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100";
  }
}