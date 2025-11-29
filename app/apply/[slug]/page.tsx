import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Orbitron, Work_Sans } from "next/font/google";
import { getAllPositions } from "@/app/actions/get-apply-positions";
import { getPositionFromSlug } from "@/lib/utils";
import { ApplyForm } from "@/components/apply-form";
import { Button } from "@/components/ui/button";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-orbitron",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-work-sans",
});

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ApplyPage({ params }: PageProps) {
  const { slug } = await params;

  // Get all positions
  const { positions } = await getAllPositions();

  // Find position by slug
  const position = getPositionFromSlug(slug, positions);

  // Check if position exists, is active, and not deleted
  if (
    !position ||
    !position.status ||
    (position as any).is_deleted === true
  ) {
    notFound();
  }

  return (
    <>
      {/* Full page background gradient - Orange light from top right */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: '#000000',
          backgroundImage: 'radial-gradient(ellipse at top right, rgba(255, 140, 0, 0.30) 0%, rgba(255, 102, 0, 0.20) 30%, rgba(0, 0, 0, 0) 70%)'
        }}
      />
      <div className="relative min-h-screen">
      {/* Main content container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12">
        {/* Back to positions link */}
        <Link href="/apply">
          <Button
            variant="ghost"
            className="mb-6 md:mb-8 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to positions
          </Button>
        </Link>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16">
          {/* Left column - Position details */}
          <div className="space-y-6 md:space-y-8">
            {/* Position title */}
            <div>
              <h1 className={`text-3xl md:text-5xl lg:text-6xl font-bold text-primary leading-tight ${orbitron.className}`}>
                {position.title}
              </h1>
            </div>

            {/* Department and Division */}
            <div className="space-y-3">
              <div>
                <h2 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1 ${workSans.className}`}>
                  Department
                </h2>
                <p className={`text-base md:text-lg text-foreground ${workSans.className}`}>
                  {position.dept_name}
                </p>
              </div>

              <div>
                <h2 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1 ${workSans.className}`}>
                  Division
                </h2>
                <p className={`text-base md:text-lg text-foreground ${workSans.className}`}>
                  {position.div_name}
                </p>
              </div>
            </div>

            {/* Description */}
            {position.description && (
              <div>
                <h2 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 ${workSans.className}`}>
                  Description
                </h2>
                <pre className={`whitespace-pre-wrap text-sm md:text-base text-muted-foreground leading-relaxed ${workSans.className}`}>
                  {position.description}
                </pre>
              </div>
            )}

            {/* Required Skills */}
            {position.required_skills &&
              position.required_skills.length > 0 && (
                <div>
                  <h2 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 ${workSans.className}`}>
                    Required Skills
                  </h2>
                  <ul className="list-disc list-outside pl-5 space-y-2">
                    {position.required_skills.map((skill, i) => (
                      <li key={i} className={`text-sm md:text-base text-muted-foreground ${workSans.className}`}>
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Desirable Skills */}
            {position.desirable_skills &&
              position.desirable_skills.length > 0 && (
                <div>
                  <h2 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 ${workSans.className}`}>
                    Desirable Skills
                  </h2>
                  <ul className="list-disc list-outside pl-5 space-y-2">
                    {position.desirable_skills.map((skill, i) => (
                      <li key={i} className={`text-sm md:text-base text-muted-foreground ${workSans.className}`}>
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>

          {/* Right column - Application form */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="p-6 md:p-8">
              <ApplyForm position={position} />
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

