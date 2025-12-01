import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAllPositions } from "@/app/actions/get-apply-positions";
import { getPositionFromSlug } from "@/lib/utils";
import { ApplyForm } from "@/components/apply-form";
import { Button } from "@/components/ui/button";

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
      {/* Light mode: softer, lighter orange glow */}
      <div
        className="fixed inset-0 -z-10 dark:hidden"
        style={{
          backgroundColor: "hsl(var(--background))",
          backgroundImage:
            "radial-gradient(ellipse at top right, rgba(255,133,77,0.45) 0%, rgba(255,160,102,0.32) 26%, rgba(255,189,133,0.2) 46%, rgba(255,214,170,0.12) 66%, rgba(0,0,0,0) 82%), url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'><filter id='noiseFilter'><feTurbulence type='fractalNoise' baseFrequency='4.22' numOctaves='5' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23noiseFilter)' opacity='0.22'/></svg>\")",
          backgroundBlendMode: "normal",
          backgroundSize: "cover, 320px 320px",
        }}
      />
      {/* Dark mode: slightly softer orange so it doesn't overpower the dark background */}
      <div
        className="fixed inset-0 -z-10 hidden dark:block"
        style={{
          backgroundColor: "hsl(var(--background))",
          backgroundImage:
            "radial-gradient(ellipse at top right, rgba(255,75,0,0.6) 0%, rgba(255,102,0,0.5) 28%, rgba(255,140,0,0.25) 48%, rgba(0,0,0,0) 72%), url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'><filter id='noiseFilter'><feTurbulence type='fractalNoise' baseFrequency='4.22' numOctaves='6' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23noiseFilter)' opacity='0.35'/></svg>\")",
          backgroundBlendMode: "soft-light",
          backgroundSize: "cover, 320px 320px",
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
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-primary leading-tight">
                {position.title}
              </h1>
            </div>

            {/* Department and Division */}
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Department
                </h2>
                <p className="text-base md:text-lg text-foreground">
                  {position.dept_name}
                </p>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Division
                </h2>
                <p className="text-base md:text-lg text-foreground">
                  {position.div_name}
                </p>
              </div>
            </div>

            {/* Description */}
            {position.description && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Description
                </h2>
                <p className="text-base md:text-lg leading-relaxed text-foreground/90">
                  {position.description}
                </p>
              </div>
            )}

            {/* Required Skills */}
            {position.required_skills &&
              position.required_skills.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Required Skills
                  </h2>
                  <ul className="list-disc list-outside pl-5 space-y-2">
                    {position.required_skills.map((skill, i) => (
                      <li key={i} className="text-sm md:text-base text-muted-foreground">
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
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Desirable Skills
                  </h2>
                  <ul className="list-disc list-outside pl-5 space-y-2">
                    {position.desirable_skills.map((skill, i) => (
                      <li key={i} className="text-sm md:text-base text-muted-foreground">
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

