"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ApplyPosition } from "@/app/actions/types";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import "@/app/globals.css";
import Link from "next/link";

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

export function ApplyPositions({
  handleDelete,
  handleOpenClosePosition,
  handleEditPosition,
  positions: initialPositions,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<ApplyPosition[]>([]);
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

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
    // Load accordion states from sessionStorage
    const savedAccordionStates = sessionStorage.getItem("accordionStates");
    if (savedAccordionStates) {
      try {
        const parsedStates = JSON.parse(savedAccordionStates);
        setOpenAccordions(new Set(parsedStates));
      } catch (error) {
        console.error(
          "Failed to parse accordion states from sessionStorage:",
          error
        );
      }
    }

    // Sort positions: active (status = true) first, then inactive (status = false)
    const sortedPositions = [...initialPositions].sort((a, b) => {
      // Convert boolean to number: true = 1, false = 0
      // Then sort in descending order (1 - 0 = 1, 0 - 1 = -1)
      return Number(b.status) - Number(a.status);
    });
    setPositions(sortedPositions);
    setLoading(false);
  }, [initialPositions]);

  // Save accordion states to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem(
      "accordionStates",
      JSON.stringify(Array.from(openAccordions))
    );
  }, [openAccordions]);

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

      setPositions(prev => prev.filter(pos => pos.id !== id));
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
      // Remove manual state update - let real-time subscription handle it
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
    setFormData(d => {
      const arr = [...d[field]];
      arr[index] = value;
      return { ...d, [field]: arr };
    });
  };
  const addArrayField = (
    field: "required_skills" | "desirable_skills" | "custom_questions"
  ) => {
    setFormData(d => ({ ...d, [field]: [...d[field], ""] }));
  };
  const removeArrayField = (
    field: "required_skills" | "desirable_skills" | "custom_questions",
    index: number
  ) => {
    setFormData(d => {
      const arr = d[field].filter((_, i) => i !== index);
      return { ...d, [field]: arr };
    });
  };

  if (loading)
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg shadow-md border border-border animate-pulse"
          >
            <div className="flex justify-between items-center border-b px-4 py-4">
              <div className="h-6 bg-gray-600 rounded w-1/3"></div>
              <div className="flex items-center space-x-2">
                <div className="h-4 bg-gray-600 rounded w-32"></div>
                <div className="h-4 bg-gray-600 rounded w-12"></div>
                <div className="h-6 w-12 bg-gray-600 rounded-full"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  if (!positions.length)
    return (
      <div className="text-muted-foreground p-4">
        No positions available at this time.
      </div>
    );

  return (
    <div className="space-y-4">
      {positions.map(pos => {
        const isEditing = editingId === pos.id;

        return (
          <Accordion
            key={pos.id}
            type="multiple"
            value={Array.from(openAccordions)}
            onValueChange={values => setOpenAccordions(new Set(values))}
            className={`rounded-lg shadow-md border ${
              pos.status ? "border-orange-600" : "border-border"
            }`}
          >
            <AccordionItem value={pos.id.toString()}>
              <AccordionTrigger className="flex justify-between items-center border-b data-[state=closed]:rounded-lg data-[state=open]:rounded-t-lg px-4 py-4 hover:bg-secondary bg-clip-padding duration-100 transition-colors">
                {isEditing ? (
                  <input
                    className="flex-1 border rounded"
                    value={formData.title}
                    onChange={e =>
                      setFormData(d => ({ ...d, title: e.target.value }))
                    }
                  />
                ) : (
                  <span className="font-semibold text-lg">{pos.title}</span>
                )}
                <div className="flex items-center ml-auto">
                  <span className="text-medium font-medium">
                    {pos.dept_name} Department – {pos.div_name} Division –&nbsp;
                  </span>
                  <span className="text-medium font-medium text-orange-600">
                    {pos.div_code}&nbsp;&nbsp;
                  </span>
                  {/* //! todo new implementation is needed for switch */}
                  {pos.canEdit ? (
                    <Switch
                      checked={pos.status}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      onCheckedChange={() =>
                        handleTogglePosition(pos.id, pos.status)
                      }
                      className="data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-200"
                    />
                  ) : null}
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-6 py-6">
                <h3 className="font-semibold text-lg mb-2">Description</h3>
                {isEditing ? (
                  <textarea
                    className="w-full border px-2 py-1 rounded mb-6"
                    rows={4}
                    value={formData.description}
                    onChange={e =>
                      setFormData(d => ({
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
                          onChange={e =>
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
                          onClick={() => removeArrayField("required_skills", i)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      onClick={() => addArrayField("required_skills")}
                    >
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
                          onChange={e =>
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
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      onClick={() => addArrayField("desirable_skills")}
                    >
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
                          onChange={e =>
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
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      onClick={() => addArrayField("custom_questions")}
                    >
                      + Add question
                    </Button>
                  </div>
                ) : (
                  <ul className="list-disc list-inside mb-10">
                    {pos.custom_questions?.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                )}
                <div
                  className={`flex justify-between items-center flex-col pt-6 ${
                    pos.canEdit ? "space-y-4" : "space-y-0"
                  } border-t`}
                >
                  <div className="flex justify-center space-x-4">
                    {isEditing ? (
                      <>
                        <Button
                          onClick={saveEdit}
                          className="bg-orange-500 text-white hover:bg-orange-600"
                        >
                          Save
                        </Button>
                        <Button onClick={cancelEdit} variant="destructive">
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        {pos.canEdit && (
                          <Button
                            onClick={() => startEdit(pos)}
                            variant="outline"
                            className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                          >
                            Edit
                          </Button>
                        )}
                        {pos.canEdit && (
                          <Button
                            onClick={() => handleDeletePosition(pos.id)}
                            variant="destructive"
                          >
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  {isEditing ? null : (
                    <Button
                      asChild
                      variant="outline"
                      className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white m-0"
                    >
                      {/* //! todo link here */}
                      <Link href="#">Apply</Link>
                    </Button>
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
