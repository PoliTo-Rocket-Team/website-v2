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
};

export function ApplyPositionsList({
  handleDelete,
  handleEditPosition,
  positions: initialPositions,
  handleAddPosition,
  editableDivisions = [],
  pageContext = "default",
  disclaimer,
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
        <div className="absolute top-[-1rem] md:top-12 right-0 -translate-y-12">
          <AddPositionDialog
            onAddPosition={handleAddPositionLocal}
            divisions={editableDivisions}
          >
            <Button className="flex items-center gap-1 md:gap-3 text-xs md:text-sm"
            >
              <Plus className="h-2 w-2 md:h-4 md:w-4" />
              Add Position
            </Button>
          </AddPositionDialog>
        </div>
      )}

      {!positions.length ? (
        <div className="text-muted-foreground p-4">
          There is no open position at the moment.
        </div>
      ) : (
        <div className="">
          <div className="hidden md:visible md:grid md:grid-cols-[3fr_2fr_2fr_auto_auto] text-center md:justify-items-start text-base px-2 py-4">
            <h3>Position</h3>
            <h3>Department</h3>
            <h3>Division</h3>
            <Button className="invisible h-4 w-4"></Button>
            {!disclaimer && <Button className="invisible md:h-6 md:w-11 h-4 w-9 px-2.5"></Button>}
          </div>
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
        </div>
      )}
    </div>
  );
}
