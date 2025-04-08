import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion";
  import { UserRoleInfo } from "@/app/actions/user/get-user-role";
  
  type Application = any;
  
  interface ApplicationsListProps {
    applications: Application[];
    userRoleInfo: UserRoleInfo;
  }
  
  export default function ApplicationsList({ applications, userRoleInfo }: ApplicationsListProps) {
    // Function to format the date
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
    };
  
    // Function to get status badge class
    const getStatusClass = (status: string) => {
      switch (status) {
        case 'accepted':
          return 'bg-green-600 text-white';
        case 'rejected':
          return 'bg-red-600 text-white';
        case 'pending':
          return 'bg-yellow-500 text-white';
        case 'received':
          return 'bg-blue-600 text-white';
        case 'accepted_by_another_team':
          return 'bg-purple-600 text-white';
        default:
          return 'bg-gray-600 text-white';
      }
    };
  
    // Determine if the user can make accept/reject decisions
    const canManageApplications = userRoleInfo.isPresident || userRoleInfo.isChief || 
                                 userRoleInfo.isCoordinator || userRoleInfo.isLead;
  
    if (applications.length === 0) {
      return (
        <div className="text-center p-6 border rounded bg-secondary">
          No applications found
        </div>
      );
    }
  
    return (
      <Accordion type="single" collapsible className="space-y-4">
        {applications.map((application) => (
          <AccordionItem 
            key={application.id} 
            value={`item-${application.id}`}
            className="border rounded-lg shadow overflow-hidden"
          >
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-accent data-[state=open]:bg-accent group">
              <div className="flex flex-col sm:flex-row w-full justify-between items-start sm:items-center text-left gap-2">
                <div className="flex-1">
                  <span className="font-semibold text-foreground group-hover:text-accent-foreground">
                    {application.users?.first_name} {application.users?.last_name}
                  </span>
                  <span className="text-foreground ml-2 group-hover:text-accent-foreground">
                    for <span className="font-medium">{application.apply_positions?.title || 'Unknown position'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-foreground group-hover:text-accent-foreground">
                    {formatDate(application.applied_at)}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusClass(application.status)}`}>
                    {application.status}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 py-4 bg-secondary">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column */}
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2 text-foreground">Applicant Information</h3>
                    <div className="bg-background p-4 rounded border space-y-2">
                      <p className="text-foreground"><span className="font-medium">Name:</span> {application.users?.first_name} {application.users?.last_name}</p>
                      {application.users?.email && (
                        <p className="text-foreground"><span className="font-medium">Email:</span> {application.users.email}</p>
                      )}
                      {application.users?.level_of_study && (
                        <p className="text-foreground"><span className="font-medium">Level of Study:</span> {application.users.level_of_study}</p>
                      )}
                      {application.users?.program && (
                        <p className="text-foreground"><span className="font-medium">Program:</span> {application.users.program}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2 text-foreground">Position Details</h3>
                    <div className="bg-background p-4 rounded border space-y-2">
                      <p className="text-foreground"><span className="font-medium">Position:</span> {application.apply_positions?.title || 'Unknown'}</p>
                      <p className="text-foreground"><span className="font-medium">Division:</span> {application.apply_positions?.divisions?.name || 'Unknown'}</p>
                      <p className="text-foreground"><span className="font-medium">Applied on:</span> {formatDate(application.applied_at)}</p>
                      <p className="text-foreground">
                        <span className="font-medium">Status:</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${getStatusClass(application.status)}`}>
                          {application.status}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Right column */}
                <div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2 text-foreground">Application Documents</h3>
                    <div className="bg-background p-4 rounded border space-y-4">
                      {application.cv_name && (
                        <div>
                          <span className="font-medium block mb-1 text-foreground">CV:</span>
                          <div className="flex items-center">
                            <span className="flex-1 truncate text-foreground">{application.cv_name}</span>
                            <button className="text-primary-foreground hover:text-primary-foreground px-3 py-1 text-sm bg-primary rounded hover:bg-primary/90">
                              View
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {application.ml_name && (
                        <div>
                          <span className="font-medium block mb-1 text-foreground">Motivation Letter:</span>
                          <div className="flex items-center">
                            <span className="flex-1 truncate text-foreground">{application.ml_name}</span>
                            <button className="text-primary-foreground hover:text-primary-foreground px-3 py-1 text-sm bg-primary rounded hover:bg-primary/90">
                              View
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {application.custom_answers && application.custom_answers.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium mb-2 text-foreground">Custom Answers</h3>
                      <div className="bg-background p-4 rounded border">
                        {application.custom_answers.map((answer: any, index: number) => (
                          <div key={index} className={index > 0 ? "mt-4 pt-4 border-t" : ""}>
                            <p className="font-medium text-foreground">{answer.question}</p>
                            <p className="text-foreground mt-1">{answer.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Only show action buttons if user has appropriate role */}
              {canManageApplications && (
                <div className="mt-6 flex justify-end gap-2">
                  <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm">
                    Accept
                  </button>
                  <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
                    Reject
                  </button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }