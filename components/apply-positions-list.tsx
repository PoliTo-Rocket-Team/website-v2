"use client";

import { useState, useEffect } from "react";
import { ApplyPosition } from "@/app/actions/types";
import { PositionCard } from "@/components/position-card";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { toast } from "sonner";
import "@/app/globals.css";

type Props = {
  positions: ApplyPosition[];
  handleDelete?: (id: number) => void;
  handleOpenClosePosition?: (id: number, isOpen: boolean) => void;
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
};

export function ApplyPositionsList({
  handleDelete,
  handleOpenClosePosition,
  handleEditPosition,
  positions: initialPositions,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<ApplyPosition[]>([]);
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

  // Load accordion states from localStorage
  useEffect(() => {
    const savedAccordionStates = localStorage.getItem("accordionStates");
    if (savedAccordionStates) {
      try {
        const parsedStates = JSON.parse(savedAccordionStates);
        setOpenAccordions(new Set(parsedStates));
      } catch (error) {
        console.error(
          "Failed to parse accordion states from localStorage:",
          error
        );
      }
    }
  }, []);

  // Save accordion states to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      "accordionStates",
      JSON.stringify(Array.from(openAccordions))
    );
  }, [openAccordions]);

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

  const handleTogglePosition = async (id: number, currentStatus: boolean) => {
    if (!handleOpenClosePosition) return;

    try {
      await handleOpenClosePosition(id, currentStatus);
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

  if (!positions.length) {
    return (
      <div className="text-muted-foreground p-4">
        No positions available at this time.
      </div>
    );
  }

  return (
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
  );
}
