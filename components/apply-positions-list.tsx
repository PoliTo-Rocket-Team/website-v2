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

// Extend ApplyPosition to include isOpen
type PositionWithState = ApplyPosition & {
  isOpen: boolean;
};

export function ApplyPositions({ className }: Props) {
  const [positions, setPositions] = useState<PositionWithState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<ApplyPosition>>({});

  useEffect(() => {
    async function fetchPositions() {
      try {
        const { positions: fetchedPositions } =
          await getApplyPositionsByUserRole();
        // Add isOpen property to each position
        const positionsWithState = fetchedPositions.map((position) => ({
          ...position,
          isOpen: false, // Initialize isOpen as false
        }));
        setPositions(positionsWithState);
      } catch (err) {
        console.error("Error fetching positions:", err);
        setError("Failed to load positions. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPositions();
  }, []);

  const handleEdit = (id: number) => {
    setEditingId(id);
    const positionToEdit = positions.find((position) => position.id === id);
    if (positionToEdit) {
      setDraft({ ...positionToEdit });
    }
  };

  const handleDraftChange = (field: keyof ApplyPosition, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (editingId === null) return;

    setPositions((prev) =>
      prev.map((position) =>
        position.id === editingId ? { ...position, ...draft } : position
      )
    );
    setEditingId(null);
    setDraft({});
  };

  const handleDelete = (id: number) => {
    setPositions((prev) => prev.filter((position) => position.id !== id));
  };

  const toggleOpenClose = (id: number) => {
    setPositions((prev) =>
      prev.map((position) =>
        position.id === id
          ? { ...position, isOpen: !position.isOpen }
          : position
      )
    );
  };

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

      <Accordion type="single" collapsible>
        {positions.map((position) => (
          <AccordionItem key={position.id} value={position.id.toString()}>
            <AccordionTrigger className="font-semibold text-lg flex justify-between items-center">
              {position.title}
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent accordion toggle
                  toggleOpenClose(position.id);
                }}
                className={`px-4 py-2 rounded ${
                  position.isOpen
                    ? "bg-green-500 text-white"
                    : "bg-gray-500 text-white"
                }`}>
                {position.isOpen ? "Close" : "Open"}
              </button>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-4">
                {editingId === position.id ? (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={draft.title || ""}
                      onChange={(e) =>
                        handleDraftChange("title", e.target.value)
                      }
                      className="border p-2 rounded w-full"
                    />
                    <textarea
                      value={draft.description || ""}
                      onChange={(e) =>
                        handleDraftChange("description", e.target.value)
                      }
                      className="border p-2 rounded w-full"
                      rows={3}
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="bg-gray-500 text-white px-4 py-2 rounded">
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        className="bg-blue-500 text-white px-4 py-2 rounded">
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
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
                    <div className="flex space-x-2 mt-4">
                      <button
                        onClick={() => handleEdit(position.id)}
                        className="bg-yellow-500 text-white px-4 py-2 rounded">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(position.id)}
                        className="bg-red-500 text-white px-4 py-2 rounded">
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
