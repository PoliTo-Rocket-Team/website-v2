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
          Pick<
            Database["public"]["Tables"]["departments"]["Row"],
            "id" | "name"
          > & {
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
  disclaimer?: string;
  selectedDepartment?: number | null;
};

export function ApplyPositionsList({
  handleDelete,
  handleEditPosition,
  positions: initialPositions,
  handleAddPosition,
  editableDivisions = [],
  pageContext = "default",
  disclaimer,
  selectedDepartment,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<ApplyPosition[]>([]);
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

  // Load accordion states from localStorage with page-specific key and time limit
  useEffect(() => {
    const storageKey = `${pageContext}AccordionStates`;
    const timestampKey = `${pageContext}AccordionStatesTimestamp`;

    const savedAccordionStates = localStorageUtils.load(storageKey, []);
    const savedTimestamp = localStorageUtils.load(timestampKey, null);

    // Check if data exists and is within time limit (24 hours = 24 * 60 * 60 * 1000 ms)
    const TIME_LIMIT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const now = Date.now();

    if (
      savedAccordionStates &&
      savedAccordionStates.length > 0 &&
      savedTimestamp &&
      now - savedTimestamp < TIME_LIMIT
    ) {
      setOpenAccordions(new Set(savedAccordionStates));
    } else if (savedTimestamp && now - savedTimestamp >= TIME_LIMIT) {
      // Clean up expired data
      localStorageUtils.save(storageKey, []);
      localStorageUtils.save(timestampKey, null);
    }
  }, [pageContext]);

  // Save accordion states to localStorage with debouncing
  useEffect(() => {
    const storageKey = `${pageContext}AccordionStates`;
    const timestampKey = `${pageContext}AccordionStatesTimestamp`;

    // Debounce the save operation by 1 second
    const timeoutId = setTimeout(() => {
      localStorageUtils.save(storageKey, Array.from(openAccordions));
      localStorageUtils.save(timestampKey, Date.now());
    }, 1000);

    // Cleanup: cancel the previous timeout if dependencies change again
    return () => clearTimeout(timeoutId);
  }, [openAccordions, pageContext]);

  useEffect(() => {
    // Filter by department if selected
    let filteredPositions = initialPositions;
    if (selectedDepartment !== null && selectedDepartment !== undefined) {
      filteredPositions = initialPositions.filter(
        (p) => p.dept_id === selectedDepartment
      );
    }
    
    // Sort positions: active (status = true) first, then inactive (status = false)
    const sortedPositions = [...filteredPositions].sort((a, b) => {
      return Number(b.status) - Number(a.status);
    });
    setPositions(sortedPositions);
    setLoading(false);
  }, [initialPositions, selectedDepartment]);

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

  const handleAddPositionLocal = async (data: {
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

  const handleTogglePosition = async (id: number, currentStatus: boolean) => {
    if (!handleEditPosition) return;

    try {
      await handleEditPosition(id, { status: !currentStatus });
      setPositions(prev =>
        prev.map(pos =>
          pos.id === id ? { ...pos, status: !currentStatus } : pos
        )
      );

      // Show success toast
      const newStatus = !currentStatus;
      toast.success(
        `Position ${newStatus ? "activated" : "deactivated"} successfully`,
        {
          description: `The position is now ${newStatus ? "active and accepting applications" : "inactive"}.`,
          duration: 3000,
        }
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

  if (loading) return <LoadingSkeleton className="max-w-5xl mx-auto" />;

  return (
    <div className="w-full relative max-w-5xl mx-auto">
      {/* Add Position button - positioned absolutely to align with title */}
      {editableDivisions.length > 0 && handleAddPosition && (
        <div className="absolute top-0 right-0 -translate-y-12">
          <AddPositionDialog
            onAddPosition={handleAddPositionLocal}
            divisions={editableDivisions}
          >
            <Button className="flex items-center gap-2 text-xs md:text-sm">
              <Plus className="h-2 w-2 md:h-4 md:w-4" />
              Add Position
            </Button>
          </AddPositionDialog>
        </div>
      )}

      {!positions.length ? (
        <div className="text-muted-foreground p-4 border-t">
          There is no open position at the moment.
        </div>
      ) : (
        <div className="space-y-2 md:space-y-4">
          {positions.map(position => (
            <PositionCard
              key={position.id}
              position={position}
              isOpen={isAccordionOpen(position.id.toString())}
              onToggleAccordion={toggleAccordion}
              onToggleStatus={handleTogglePosition}
              onDelete={handleDeletePosition}
              onEdit={handleEditPositionLocal}
              disclaimer={disclaimer}
            />
          ))}
        </div>
      )}
    </div>
  );
}
