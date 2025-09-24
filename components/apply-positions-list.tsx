"use client";

import { useState, useEffect } from "react";
import { ApplyPosition } from "@/app/actions/types";
import { PositionCard } from "@/components/position-card";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { AddPositionDialog } from "@/components/add-position-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { localStorageUtils } from "@/lib/localStorage";
import { Database } from "@/types/supabase";
import { Prettify } from "@/lib/utils";


//component-specific Division type with non-nullable code and departments.code
type ComponentDivision = Prettify<
  Pick<Database["public"]["Tables"]["divisions"]["Row"], "id" | "name"> & {
    code: string; // Override to make non-nullable for component needs
    departments:
      | Prettify<
          Pick<Database["public"]["Tables"]["departments"]["Row"], "id" | "name"> & {
            code: string; // Override to make non-nullable for component needs
          }
        >[]
      | null;
  }
>;

type Props = {
  positions: ApplyPosition[];
  handleDelete?: (id: number) => void;
  handleEditPosition?: (
    id: number,
    data: Partial<{
      title: string;
      description: string;
      status: boolean;
      required_skills: string[];
      desirable_skills: string[];
      custom_questions: string[];
    }>
  ) => void;
  handleAddPosition?: (data: {
    title: string;
    description: string;
    required_skills: string[];
    desirable_skills: string[];
    custom_questions: string[];
    requires_motivation_letter: boolean;
    division_id: number;
  }) => Promise<ApplyPosition>;
  editableDivisions?: ComponentDivision[];
  pageContext?: string;
};

export function ApplyPositionsList({
  handleDelete,
  handleEditPosition,
  positions: initialPositions,
  handleAddPosition,
  editableDivisions = [],
  pageContext = "default",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<ApplyPosition[]>([]);
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

  // Load accordion states from localStorage with page-specific key
  useEffect(() => {
    const storageKey = `${pageContext}AccordionStates`;
    const savedAccordionStates = localStorageUtils.load(storageKey, []);
    if (savedAccordionStates && savedAccordionStates.length > 0) {
      setOpenAccordions(new Set(savedAccordionStates));
    }
  }, [pageContext]);

  // Save accordion states to localStorage whenever they change
  useEffect(() => {
    const storageKey = `${pageContext}AccordionStates`;
    localStorageUtils.save(storageKey, Array.from(openAccordions));
  }, [openAccordions, pageContext]);

  useEffect(() => {
    // Sort positions: active (status = true) first, then inactive (status = false)
    const sortedPositions = [...initialPositions].sort((a, b) => {
      return Number(b.status) - Number(a.status);
    });
    setPositions(sortedPositions);
    setLoading(false);
  }, [initialPositions]);

  const toggleAccordion = (id: string, isOpen: boolean) => {
    setOpenAccordions(prev => {
      const newSet = new Set(prev);
      if (isOpen) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const isAccordionOpen = (id: string) => openAccordions.has(id);

  const handleAddPositionWithUpdate = async (data: {
    title: string;
    description: string;
    required_skills: string[];
    desirable_skills: string[];
    custom_questions: string[];
    requires_motivation_letter: boolean;
    division_id: number;
  }): Promise<ApplyPosition> => {
    if (!handleAddPosition) {
      throw new Error("handleAddPosition is not provided");
    }

    // Call the server action to add the position
    const newPosition = await handleAddPosition(data);

    // Add the new position to the current list
    setPositions(prev => {
      const newPositions = [newPosition, ...prev];
      // Sort positions: active (status = true) first, then inactive (status = false)
      return newPositions.sort((a, b) => {
        return Number(b.status) - Number(a.status);
      });
    });

    return newPosition;
  };

  const addPosition = (position: ApplyPosition) => {
    setPositions(prev => {
      const newPositions = [...prev, position];

      // Sort positions: active (status = true) first, then inactive (status = false)
      return newPositions.sort((a, b) => {
        return Number(b.status) - Number(a.status);
      });
    });

    // Show success toast
    toast.success("Position added successfully", {
      description: `${position.title} has been created.`,
      duration: 4000,
    });
  };

  const handleTogglePosition = async (id: number, currentStatus: boolean) => {
    if (!handleEditPosition) return;

    try {
      await handleEditPosition(id, { status: !currentStatus });
      setPositions(prev =>
        prev.map(pos =>
          pos.id === id ? { ...pos, status: !currentStatus } : pos
        )
      );
    } catch (err) {
      console.error("Failed to toggle position status:", err);
      toast.error("Failed to update position status", {
        description:
          err instanceof Error
            ? err.message
            : "Please try again or contact support if the problem persists.",
        duration: 5000,
      });
    }
  };

  const handleDeletePosition = async (id: number) => {
    if (!handleDelete) return;

    try {
      await handleDelete(id);
      setPositions(prev => prev.filter(pos => pos.id !== id));

      // Show success toast
      toast.success("Position deleted successfully", {
        description: "The position has been removed.",
        duration: 4000,
      });
    } catch (err) {
      console.error("Failed to delete position:", err);
      toast.error("Failed to delete position", {
        description:
          err instanceof Error
            ? err.message
            : "Please try again or contact support if the problem persists.",
        duration: 5000,
      });
    }
  };

  const handleEditPositionLocal = async (id: number, data: any) => {
    if (!handleEditPosition) return;

    try {
      await handleEditPosition(id, data);
      // Update the local state to re-render the position with new data
      setPositions(prev =>
        prev.map(pos => (pos.id === id ? { ...pos, ...data } : pos))
      );

      // Show success toast
      toast.success("Changes saved successfully", {
        description: data.title
          ? `${data.title} position has been updated`
          : "Position has been updated",
        duration: 3000,
      });
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save changes", {
        description:
          err instanceof Error
            ? err.message
            : "Please try again or contact support if the problem persists.",
        duration: 5000,
      });
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="w-full relative">
      {/* Add Position button - positioned absolutely to align with title */}
      {editableDivisions.length > 0 && handleAddPosition && (
        <div className="absolute top-0 right-0 -translate-y-12">
          <AddPositionDialog
            onAddPosition={handleAddPositionWithUpdate}
            divisions={editableDivisions}
          >
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Position
            </Button>
          </AddPositionDialog>
        </div>
      )}

      {!positions.length ? (
        <div className="text-muted-foreground p-4">
          No positions available at this time.
        </div>
      ) : (
        <div className="space-y-4">
          {positions.map(position => (
            <PositionCard
              key={position.id}
              position={position}
              isOpen={isAccordionOpen(position.id.toString())}
              onToggleAccordion={toggleAccordion}
              onToggleStatus={handleTogglePosition}
              onDelete={handleDeletePosition}
              onEdit={handleEditPositionLocal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
