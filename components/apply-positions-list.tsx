"use client";
import * as React from "react";
import Switch from "@mui/material/Switch";
import { styled } from "@mui/material/styles";
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
import "@/app/globals.css";

type Props = {
  className?: string;
};

const OrangeSwitch = styled(Switch)(({ theme }) => ({
  width: 42,
  height: 26,
  padding: 0,
  "& .MuiSwitch-switchBase": {
    padding: 0,
    margin: 2,
    transitionDuration: "300ms",
    "&.Mui-checked": {
      transform: "translateX(16px)",
      color: "#fff",
      "& + .MuiSwitch-track": {
        backgroundColor: "#FF7C0A",
        opacity: 1,
        border: 0,
      },
    },
  },
  "& .MuiSwitch-thumb": {
    boxSizing: "border-box",
    width: 22,
    height: 22,
    backgroundColor: "#fff",
  },
  "& .MuiSwitch-track": {
    borderRadius: 26 / 2,
    backgroundColor: "#E9E9EA",
    opacity: 1,
    transition: theme.transitions.create(["background-color"], {
      duration: 500,
    }),
  },
}));

export function ApplyPositions({ className }: Props) {
  const [positions, setPositions] = useState<ApplyPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [switchStates, setSwitchStates] = useState<Record<string, boolean>>({});

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

  const handleEdit = (id: string) => console.log(`Edit position ${id}`);
  const handleDelete = (id: string) => console.log(`Delete position ${id}`);
  const handleToggle = (id: string, checked: boolean) => {
    setSwitchStates((prev) => ({ ...prev, [id]: checked }));
    console.log(`Toggled ${id}:`, checked);
  };

  if (isLoading)
    return (
      <div className="flex justify-center items-center p-8">
        Loading positions...
      </div>
    );
  if (error)
    return (
      <div className="text-destructive p-4 border border-destructive rounded">
        {error}
      </div>
    );
  if (!positions.length)
    return (
      <div className="text-muted-foreground p-4">
        No open positions available at this time.
      </div>
    );

  return (
    <div >
      <Accordion
        type="single"
        collapsible
        value={expandedId || undefined}
        onValueChange={setExpandedId}
        className="space-y-4">
        {positions.map((position) => {
          const idStr = position.id.toString();
          const isExpanded = expandedId === idStr;
          const switchChecked = !!switchStates[idStr];

          return (
            <AccordionItem
              key={idStr}
              value={idStr}
              className="bg-card text-card-foreground rounded-lg shadow-md border border-border">
              <AccordionTrigger className="flex items-center justify-between pl-6 pr-2 py-4 hover:bg-secondary transition-colors">
                <span className="font-semibold text-lg">{position.title}</span>
                {isExpanded && (
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-muted-foreground">
                      {position.divisions?.departments?.name} -{" "}
                      {position.divisions?.name}
                    </span>
                    <span className="text-sm font-medium text-orange-500">
                      {position.id}
                    </span>
                    <OrangeSwitch
                      checked={switchChecked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(_, checked) => handleToggle(idStr, checked)}
                      size="small"
                      disableRipple
                    />
                  </div>
                )}
              </AccordionTrigger>

              {isExpanded && (
                <>
                  <div className="border-t border-border" />
                  <AccordionContent className="px-6 py-6">
                    <h3 className="font-semibold text-lg mb-2">Description</h3>
                    {position.description && (
                      <p className="mb-4">{position.description}</p>
                    )}

                    {Array.isArray(position.required_skills) &&
                      position.required_skills.length > 0 && (
                        <>
                          <h4 className="font-semibold text-sm mb-1">
                            Required Skills
                          </h4>
                          <ul className="list-disc list-inside mb-4">
                            {position.required_skills.map((skill, idx) => (
                              <li key={idx}>{skill}</li>
                            ))}
                          </ul>
                        </>
                      )}

                    {Array.isArray(position.desirable_skills) &&
                      position.desirable_skills.length > 0 && (
                        <>
                          <h4 className="font-semibold text-sm mb-1">
                            Desirable Skills
                          </h4>
                          <ul className="list-disc list-inside mb-4">
                            {position.desirable_skills.map((skill, idx) => (
                              <li key={idx}>{skill}</li>
                            ))}
                          </ul>
                        </>
                      )}

                    {Array.isArray(position.custom_questions) &&
                      position.custom_questions.length > 0 && (
                        <>
                          <h4 className="font-semibold text-sm mb-1">
                            Custom Questions
                          </h4>
                          <ul className="list-disc list-inside mb-4">
                            {position.custom_questions.map((q, idx) => (
                              <li key={idx}>{q}</li>
                            ))}
                          </ul>
                        </>
                      )}

                    <div className="mt-6 flex justify-center space-x-4">
                      <button
                        onClick={() => handleEdit(idStr)}
                        className="px-4 py-2 border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white rounded">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(idStr)}
                        className="px-4 py-2 border-2 border-muted text-muted-foreground hover:bg-muted hover:text-white rounded">
                        Delete
                      </button>
                    </div>
                  </AccordionContent>
                </>
              )}
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
