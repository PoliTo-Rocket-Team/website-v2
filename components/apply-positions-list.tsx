"use client";
import { ApplyPosition } from "@/app/actions/user/get-apply-positions";
import "@/app/globals.css";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { styled } from "@mui/material/styles";
import Switch from "@mui/material/Switch";
import * as React from "react";
import { useEffect, useState } from "react";

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
  renderActionButtons?: (position: ApplyPosition) => React.ReactNode;
  showStatusSwitch?: boolean;
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

export function ApplyPositions({
  handleDelete,
  handleOpenClosePosition,
  handleEditPosition,
  positions: initialPositions,
  renderActionButtons,
  showStatusSwitch = true,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [positionsState, setPositionsState] = useState<ApplyPosition[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    required_skills: string[];
    desirable_skills: string[];
    custom_questions: string[];
  }>({
    title: "",
    description: "",
    required_skills: [],
    desirable_skills: [],
    custom_questions: [],
  });

  useEffect(() => {
    setPositionsState(initialPositions);
    setLoading(false);
  }, [initialPositions]);

  const handleTogglePosition = async (id: number, currentStatus: boolean) => {
    if (!handleOpenClosePosition) return;
    try {
      await handleOpenClosePosition(id, currentStatus);
      setPositionsState((prev) =>
        prev.map((pos) =>
          pos.id === id ? { ...pos, status: !currentStatus } : pos
        )
      );
    } catch (err) {
      console.error("Failed to toggle position status:", err);
      alert("Failed to update position status. Please try again.");
    }
  };

  const handleDeletePosition = async (id: number) => {
    if (!handleDelete) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this position? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      await handleDelete(id);
      setPositionsState((prev) => prev.filter((pos) => pos.id !== id));
    } catch (err) {
      console.error("Failed to delete position:", err);
      alert("Failed to delete position. Please try again.");
    }
  };

  const startEdit = (pos: ApplyPosition) => {
    setEditingId(pos.id);
    setFormData({
      title: pos.title || " ",
      description: pos.description || "",
      required_skills: pos.required_skills ?? [],
      desirable_skills: pos.desirable_skills ?? [],
      custom_questions: pos.custom_questions ?? [],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (editingId == null || !handleEditPosition) return;
    try {
      await handleEditPosition(editingId, {
        title: formData.title,
        description: formData.description,
        required_skills: formData.required_skills,
        desirable_skills: formData.desirable_skills,
        custom_questions: formData.custom_questions,
      });
      setPositionsState((prev) =>
        prev.map((p) => (p.id === editingId ? { ...p, ...formData } : p))
      );
      setEditingId(null);
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save changes. Please try again.");
    }
  };

  const updateArrayField = (
    field: "required_skills" | "desirable_skills" | "custom_questions",
    index: number,
    value: string
  ) => {
    setFormData((d) => {
      const arr = [...d[field]];
      arr[index] = value;
      return { ...d, [field]: arr };
    });
  };
  
  const addArrayField = (
    field: "required_skills" | "desirable_skills" | "custom_questions"
  ) => {
    setFormData((d) => ({ ...d, [field]: [...d[field], ""] }));
  };
  
  const removeArrayField = (
    field: "required_skills" | "desirable_skills" | "custom_questions",
    index: number
  ) => {
    setFormData((d) => {
      const arr = d[field].filter((_, i) => i !== index);
      return { ...d, [field]: arr };
    });
  };

  if (loading)
    return <div className="p-8 text-center">Loading positions...</div>;
  if (!positionsState.length)
    return (
      <div className="text-muted-foreground p-4">
        No positions available at this time.
      </div>
    );

  return (
    <div className="space-y-4">
      {positionsState.map((pos) => {
        const isEditing = editingId === pos.id;

        return (
          <Accordion
            key={pos.id}
            type="single"
            collapsible
            className="bg-card text-card-foreground rounded-lg shadow-md border border-border">
            <AccordionItem value={pos.id.toString()}>
              <AccordionTrigger className="flex items-center justify-between pl-6 pr-2 py-4 hover:bg-secondary transition-colors">
                {isEditing ? (
                  <input
                    className="flex-1 border px-2 py-1 rounded"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((d) => ({ ...d, title: e.target.value }))
                    }
                  />
                ) : (
                  <span className="font-semibold text-lg">{pos.title}</span>
                )}

                <div className="flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground">
                    {pos.divisions?.departments?.name} – {pos.divisions?.name}
                  </span>
                  <span className="text-sm font-medium text-orange-500">
                    {pos.divisions?.code}
                  </span>
                  {showStatusSwitch && (
                    <OrangeSwitch
                      checked={pos.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => handleTogglePosition(pos.id, pos.status)}
                      size="small"
                      disableRipple
                    />
                  )}
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-6 pb-6">
                <h3 className="font-semibold text-lg mb-2">Description</h3>
                {isEditing ? (
                  <textarea
                    className="w-full border px-2 py-1 rounded mb-6"
                    rows={4}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((d) => ({
                        ...d,
                        description: e.target.value,
                      }))
                    }
                  />
                ) : (
                  <p className="mb-10">{pos.description}</p>
                )}

                <h4 className="font-semibold text-sm mb-1">Required Skills</h4>
                {isEditing ? (
                  <div className="mb-4 space-y-2">
                    {formData.required_skills.map((skill, i) => (
                      <div key={i} className="flex space-x-2">
                        <input
                          className="flex-1 border px-2 py-1 rounded"
                          value={skill}
                          onChange={(e) =>
                            updateArrayField(
                              "required_skills",
                              i,
                              e.target.value
                            )
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            removeArrayField("required_skills", i)
                          }>
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      onClick={() => addArrayField("required_skills")}>
                      + Add required skill
                    </Button>
                  </div>
                ) : (
                  <ul className="list-disc list-inside mb-10">
                    {pos.required_skills?.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}

                <h4 className="font-semibold text-sm mb-1">Desirable Skills</h4>
                {isEditing ? (
                  <div className="mb-4 space-y-2">
                    {formData.desirable_skills.map((skill, i) => (
                      <div key={i} className="flex space-x-2">
                        <input
                          className="flex-1 border px-2 py-1 rounded"
                          value={skill}
                          onChange={(e) =>
                            updateArrayField(
                              "desirable_skills",
                              i,
                              e.target.value
                            )
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            removeArrayField("desirable_skills", i)
                          }>
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      onClick={() => addArrayField("desirable_skills")}>
                      + Add desirable skill
                    </Button>
                  </div>
                ) : (
                  <ul className="list-disc list-inside mb-10">
                    {pos.desirable_skills?.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}

                <h4 className="font-semibold text-sm mb-1">Custom Questions</h4>
                {isEditing ? (
                  <div className="mb-6 space-y-2">
                    {formData.custom_questions.map((q, i) => (
                      <div key={i} className="flex space-x-2">
                        <input
                          className="flex-1 border px-2 py-1 rounded"
                          value={q}
                          onChange={(e) =>
                            updateArrayField(
                              "custom_questions",
                              i,
                              e.target.value
                            )
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            removeArrayField("custom_questions", i)
                          }>
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      onClick={() => addArrayField("custom_questions")}>
                      + Add question
                    </Button>
                  </div>
                ) : (
                  <ul className="list-disc list-inside mb-10">
                    {pos.custom_questions?.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                )}

                <div className="flex space-x-2">
                  {renderActionButtons ? (
                    renderActionButtons(pos)
                  ) : (
                    <>
                      {isEditing ? (
                        <>
                          <Button
                            onClick={saveEdit}
                            className="bg-orange-500 text-white hover:bg-orange-600">
                            Save
                          </Button>
                          <Button
                            onClick={cancelEdit}
                            variant="outline">
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={() => startEdit(pos)}
                            variant="outline"
                            className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleDeletePosition(pos.id)}
                            variant="outline">
                            Delete
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      })}
    </div>
  );
}
