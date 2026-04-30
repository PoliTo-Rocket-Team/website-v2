"use client";

import { useEffect, useState } from "react";
import { ApplyPosition } from "@/app/actions/types";
import { PositionCard } from "@/components/position-card";
import { AddPositionDialog } from "@/components/add-position-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Division } from "@/db/types";

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
    }>,
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
  editableDivisions?: Division[];
  pageContext?: string;
  disclaimer?: string;
};

export function ApplyPositionsList({
  handleDelete,
  handleEditPosition,
  positions: initialPositions,
  handleAddPosition,
  editableDivisions = [],
  disclaimer,
}: Props) {
  const [positions, setPositions] = useState<ApplyPosition[]>(initialPositions);
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  const toggleAccordion = (id: string, isOpen: boolean) => {
    setOpenAccordions((prev) => {
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

    // Add the new position to the current list without reordering the rest.
    setPositions((prev) => [newPosition, ...prev]);

    return newPosition;
  };

  const handleTogglePosition = async (id: number, currentStatus: boolean) => {
    if (!handleEditPosition) return;

    try {
      await handleEditPosition(id, { status: !currentStatus });
      setPositions((prev) =>
        prev.map((pos) =>
          pos.id === id ? { ...pos, status: !currentStatus } : pos,
        ),
      );

      // Show success toast
      const newStatus = !currentStatus;
      toast.success(
        `Position ${newStatus ? "activated" : "deactivated"} successfully`,
        {
          description: `The position is now ${newStatus ? "active and accepting applications" : "inactive"}.`,
          duration: 3000,
        },
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
      setPositions((prev) => prev.filter((pos) => pos.id !== id));

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
      setPositions((prev) =>
        prev.map((pos) => (pos.id === id ? { ...pos, ...data } : pos)),
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
          {positions.map((position) => (
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
