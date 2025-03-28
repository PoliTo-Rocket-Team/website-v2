"use client";

import { useState, useEffect } from "react";
import {
  getApplyPositionsByUserRole,
  ApplyPosition,
} from "@/app/actions/user/get-apply-positions";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

type Props = {
  className?: string;
};

export function ApplyPositions({ className }: Props) {
  const [positions, setPositions] = useState<ApplyPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPositions() {
      try {
        const { positions: fetchedPositions } =
          await getApplyPositionsByUserRole();
        setPositions(fetchedPositions);
      } catch (err) {
        console.error("Error fetching positions:", err);
        setError("Failed to load positions. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPositions();
  }, []);

  // Group positions by division for better organization
  const positionsByDivision: Record<string, ApplyPosition[]> = {};

  positions.forEach(position => {
    const divisionName = position.divisions?.name || "Other";
    if (!positionsByDivision[divisionName]) {
      positionsByDivision[divisionName] = [];
    }
    positionsByDivision[divisionName].push(position);
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        Loading positions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 border border-red-200 rounded">
        {error}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="text-gray-500 p-4">
        No open positions available at this time.
      </div>
    );
  }

  return (
    <div className={className}>
      <h2 className="text-2xl font-bold text-center m-4">Positions</h2>

      {Object.entries(positionsByDivision).map(
        ([divisionName, divisionPositions]) => (
          <Accordion
            key={divisionName}
            type="single"
            collapsible
            className="mb-4"
          >
            <AccordionItem value={divisionName}>
              <AccordionTrigger className="font-semibold text-lg">
                {divisionName} - {divisionPositions[0]?.divisions?.code || ""}
              </AccordionTrigger>
              <AccordionContent>
                <Accordion type="single" collapsible>
                  {divisionPositions.map(position => (
                    <AccordionItem
                      className="ml-4"
                      key={position.id}
                      value={position.id.toString()}
                    >
                      <AccordionTrigger className="font-medium">
                        {position.title}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="p-4">
                          {position.description && (
                            <p className="mt-2 text-gray-700">
                              {position.description}
                            </p>
                          )}
                          <div className="mt-3">
                            {position.required_skills && (
                              <div className="mb-2">
                                <h5 className="font-semibold text-sm">
                                  Required Skills:
                                </h5>
                                <p className="text-gray-700 text-sm">
                                  {position.required_skills}
                                </p>
                              </div>
                            )}
                            {position.desirable_skills && (
                              <div>
                                <h5 className="font-semibold text-sm">
                                  Desirable Skills:
                                </h5>
                                <p className="text-gray-700 text-sm">
                                  {position.desirable_skills}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )
      )}
    </div>
  );
}
