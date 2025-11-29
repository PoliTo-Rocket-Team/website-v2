import { notFound } from "next/navigation";
import { getPositionById } from "@/app/actions/get-position-by-id";
import { ApplicationForm } from "@/components/application-form";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ApplyPositionPage({ params }: PageProps) {
  // Await params in Next.js 15
  const { id } = await params;
  
  // Fetch position data
  const positionId = parseInt(id);
  
  if (isNaN(positionId)) {
    notFound();
  }

  const position = await getPositionById(positionId);

  if (!position) {
    notFound();
  }

  // Check if position is active
  if (!position.status) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-yellow-800 mb-2">
            Position Not Available
          </h2>
          <p className="text-yellow-700">
            This position is no longer accepting applications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Position Information */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-5xl font-bold text-primary mb-4">
          {position.title}
        </h1>
        
        <div className="flex flex-wrap gap-4 text-sm md:text-base text-muted-foreground mb-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Department:</span>
            <span>{position.dept_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Division:</span>
            <span>{position.div_name}</span>
          </div>
        </div>

        <div className="border-t pt-6 space-y-6">
          <div>
            <h3 className="font-semibold text-lg md:text-xl mb-2">Description</h3>
            <pre className="whitespace-pre-wrap font-sans text-sm md:text-base leading-relaxed text-muted-foreground">
              {position.description}
            </pre>
          </div>

          {position.required_skills && position.required_skills.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg md:text-xl mb-2">
                Required Skills
              </h3>
              <ul className="list-disc list-outside pl-5 space-y-1 text-sm md:text-base text-muted-foreground">
                {position.required_skills.map((skill, i) => (
                  <li key={i}>{skill}</li>
                ))}
              </ul>
            </div>
          )}

          {position.desirable_skills && position.desirable_skills.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg md:text-xl mb-2">
                Desirable Skills
              </h3>
              <ul className="list-disc list-outside pl-5 space-y-1 text-sm md:text-base text-muted-foreground">
                {position.desirable_skills.map((skill, i) => (
                  <li key={i}>{skill}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Application Form */}
      <div className="border-t pt-8">
        <h2 className="text-2xl md:text-3xl font-bold text-primary mb-6">
          Submit Your Application
        </h2>
        <ApplicationForm position={position} />
      </div>
    </div>
  );
}

