import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AutoGrowTextarea } from "@/components/ui/textarea";
import { ApplyPosition } from "@/app/actions/types";
import { toast } from "sonner";

type PositionFormData = {
  title: string;
  description: string;
  required_skills: string[];
  desirable_skills: string[];
  custom_questions: string[];
  requires_motivation_letter: boolean;
};

type PositionEditFormProps = {
  position: ApplyPosition;
  onSave: (data: PositionFormData) => void;
  onCancel: () => void;
};

function ArrayField({
  title,
  items,
  placeholder,
  addButtonText,
  onUpdate,
  onAdd,
  onRemove,
  className = "mb-4",
}: {
  title: string;
  items: string[];
  placeholder: string;
  addButtonText: string;
  onUpdate: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  className?: string;
}) {
  return (
    <>
      <h4 className="font-semibold text-base mb-1">{title}</h4>
      <div className={`${className} space-y-2`}>
        {items.map((item, i) => (
          <div key={i} className="flex space-x-2">
            <AutoGrowTextarea
              className="flex-1 border px-2 py-2 rounded resize-none overflow-hidden"
              value={item}
              onChange={e => onUpdate(i, e.target.value)}
              placeholder={placeholder}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemove(i)}
              disabled={items.length <= 1}
              className={
                items.length <= 1 ? "opacity-50 cursor-not-allowed" : ""
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <Button size="sm" onClick={onAdd}>
          {addButtonText}
        </Button>
      </div>
    </>
  );
}

export function PositionEditForm({
  position,
  onSave,
  onCancel,
}: PositionEditFormProps) {
  const [formData, setFormData] = useState<PositionFormData>({
    title: position.title || "",
    description: position.description || "",
    required_skills: position.required_skills ?? [],
    desirable_skills: position.desirable_skills ?? [],
    custom_questions: position.custom_questions ?? [],
    requires_motivation_letter:
      (position as PositionFormData).requires_motivation_letter ?? false,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  // Load form data from localStorage on mount
  useEffect(() => {
    const savedFormData = localStorage.getItem(`editFormData_${position.id}`);
    console.log(
      `Loading saved data for position ${position.id}:`,
      savedFormData
    );
    if (savedFormData) {
      try {
        const parsedData = JSON.parse(savedFormData);
        console.log("Parsed saved data:", parsedData);
        setFormData(parsedData);
      } catch (error) {
        console.error("Failed to parse saved form data:", error);
      }
    }
    setIsInitialized(true);
  }, [position.id]);

  // Save form data to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) {
      console.log(`Saving form data for position ${position.id}:`, formData);
      localStorage.setItem(
        `editFormData_${position.id}`,
        JSON.stringify(formData)
      );
    }
  }, [formData, position.id, isInitialized]);

  // Clear form data from localStorage when saving or canceling
  const clearSavedFormData = () => {
    localStorage.removeItem(`editFormData_${position.id}`);
  };

  // Generic array updater
  const updateArrayItem = (
    field: keyof Pick<
      PositionFormData,
      "required_skills" | "desirable_skills" | "custom_questions"
    >,
    index: number,
    value: string
  ) => {
    setFormData(d => {
      const updated = [...d[field]];
      updated[index] = value;
      return { ...d, [field]: updated };
    });
  };

  const addArrayItem = (
    field: keyof Pick<
      PositionFormData,
      "required_skills" | "desirable_skills" | "custom_questions"
    >
  ) => {
    setFormData(d => ({ ...d, [field]: [...d[field], ""] }));
  };

  const removeArrayItem = (
    field: keyof Pick<
      PositionFormData,
      "required_skills" | "desirable_skills" | "custom_questions"
    >,
    index: number
  ) => {
    setFormData(d => ({
      ...d,
      [field]: d[field].filter((_, i) => i !== index),
    }));
  };

  return (
    <>
      <h3 className="font-semibold text-lg mb-2">Title *</h3>
      <AutoGrowTextarea
        className="flex-1 border rounded px-2 py-2 mb-6 w-2/3"
        value={formData.title}
        onChange={e => setFormData(d => ({ ...d, title: e.target.value }))}
        onClick={e => e.stopPropagation()}
      />
      <h3 className="font-semibold text-lg mb-2">Description *</h3>
      <AutoGrowTextarea
        className="w-full border px-2 py-1 rounded mb-6 resize-none overflow-hidden"
        value={formData.description}
        onChange={e =>
          setFormData(d => ({
            ...d,
            description: e.target.value,
          }))
        }
        placeholder="Enter position description..."
      />

      <ArrayField
        title="Required Skills *"
        items={formData.required_skills}
        placeholder="Enter required skill"
        addButtonText="+ Add required skill"
        onUpdate={(i, value) => updateArrayItem("required_skills", i, value)}
        onAdd={() => addArrayItem("required_skills")}
        onRemove={i => removeArrayItem("required_skills", i)}
      />

      <ArrayField
        title="Desirable Skills *"
        items={formData.desirable_skills}
        placeholder="Enter desirable skill"
        addButtonText="+ Add desirable skill"
        onUpdate={(i, value) => updateArrayItem("desirable_skills", i, value)}
        onAdd={() => addArrayItem("desirable_skills")}
        onRemove={i => removeArrayItem("desirable_skills", i)}
      />

      <div className="mb-4">
        <h4 className="font-semibold text-sm mb-1">Custom Questions</h4>
        <p className="text-xs text-gray-600 mb-3 w-3/4">
          Default informations (CV, name, surname, email, major, graduation
          year, etc.) will be asked automatically. If you want to ask specific
          questions to applicants for this position, add them to this box below.
        </p>
      </div>
      <ArrayField
        title=""
        items={formData.custom_questions}
        placeholder="Enter question"
        addButtonText="+ Add question"
        onUpdate={(i, value) => updateArrayItem("custom_questions", i, value)}
        onAdd={() => addArrayItem("custom_questions")}
        onRemove={i => removeArrayItem("custom_questions", i)}
        className="mb-6"
      />

      <div className="mb-6">
        <h3 className="font-semibold text-base mb-2">Requirements</h3>
        <div className="flex items-center space-x-3 mb-4">
          <Switch
            checked={formData.requires_motivation_letter}
            onCheckedChange={checked =>
              setFormData(d => ({ ...d, requires_motivation_letter: checked }))
            }
            className="data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-200"
          />
          <label className="text-sm font-medium">
            Require motivation letter from applicants for this position
          </label>
        </div>
      </div>

      <div className="flex justify-between items-center flex-col pt-6 space-y-4 border-t">
        <div className="flex justify-center space-x-4">
          <Button
            variant="default"
            onClick={() => {
              // Filter out empty entries before validation
              const filteredData = {
                ...formData,
                required_skills: formData.required_skills.filter(
                  skill => skill.trim() !== ""
                ),
                desirable_skills: formData.desirable_skills.filter(
                  skill => skill.trim() !== ""
                ),
                custom_questions: formData.custom_questions.filter(
                  question => question.trim() !== ""
                ),
              };

              // Validate required fields
              const validateRequiredFields = () => {
                const missingFields = [];

                if (!filteredData.title.trim()) {
                  missingFields.push("title");
                }
                if (!filteredData.description.trim()) {
                  missingFields.push("description");
                }
                if (filteredData.required_skills.length === 0) {
                  missingFields.push("required skills");
                }
                if (filteredData.desirable_skills.length === 0) {
                  missingFields.push("desirable skills");
                }

                if (missingFields.length > 1) {
                  toast.error("Please fill in all required fields");
                  return false;
                } else if (missingFields.length === 1) {
                  const field = missingFields[0];
                  if (field === "required skills") {
                    toast.error("At least one required skill must be provided");
                  } else if (field === "desirable skills") {
                    toast.error(
                      "At least one desirable skill must be provided"
                    );
                  } else {
                    toast.error(`Please fill in the ${field} field`);
                  }
                  return false;
                }

                return true;
              };

              if (!validateRequiredFields()) {
                return;
              }

              clearSavedFormData();
              const cleanedData = {
                ...filteredData,
                requires_motivation_letter: formData.requires_motivation_letter,
              };
              onSave(cleanedData);
            }}
            className="bg-blue-400"
          >
            Save
          </Button>
          <Button
            onClick={() => {
              clearSavedFormData();
              onCancel();
            }}
            variant="destructive"
          >
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
