"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AutoGrowTextarea } from "@/components/ui/textarea";
import { ArrayField } from "@/components/ui/array-field";
import { ApplyPosition } from "@/app/actions/types";
import { validateAndShowErrors, createValidationRules } from "@/lib/validation";
import { localStorageUtils } from "@/lib/localStorage";

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
    const defaultFormData = {
      title: position.title || "",
      description: position.description || "",
      required_skills: position.required_skills ?? [],
      desirable_skills: position.desirable_skills ?? [],
      custom_questions: position.custom_questions ?? [],
      requires_motivation_letter:
        (position as PositionFormData).requires_motivation_letter ?? false,
    };

    const savedFormData = localStorageUtils.load(
      `editFormData_${position.id}`,
      defaultFormData
    );

    if (savedFormData) {
      setFormData(savedFormData);
    }
    setIsInitialized(true);
  }, [position.id]);

  // Save form data to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (isInitialized) {
      localStorageUtils.save(`editFormData_${position.id}`, formData);
    }
  }, [formData, position.id, isInitialized]);

  // Clear form data from localStorage when saving or canceling
  const clearSavedFormData = () => {
    localStorageUtils.remove(`editFormData_${position.id}`);
  };

  return (
    <>
      <h3 className="font-semibold text-lg mb-2">
        Title<span className="text-red-500 ml-1">*</span>
      </h3>
      <AutoGrowTextarea
        className="flex-1 border rounded px-2 py-2 mb-6 w-2/3"
        value={formData.title}
        onChange={e => setFormData(d => ({ ...d, title: e.target.value }))}
        onClick={e => e.stopPropagation()}
      />
      <h3 className="font-semibold text-lg mb-2">
        Description<span className="text-red-500 ml-1">*</span>
      </h3>
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
        title="Required Skills"
        required
        value={formData.required_skills}
        onChange={value => setFormData(d => ({ ...d, required_skills: value }))}
        placeholder="Enter required skill"
        addButtonText="+ Add required skill"
      />

      <ArrayField
        title="Desirable Skills"
        required
        value={formData.desirable_skills}
        onChange={value =>
          setFormData(d => ({ ...d, desirable_skills: value }))
        }
        placeholder="Enter desirable skill"
        addButtonText="+ Add desirable skill"
      />

      <ArrayField
        title="Custom Questions"
        description="Default informations (CV, name, surname, email, major, graduation year, etc.) will be asked automatically. If you want to ask specific questions to applicants for this position, add them to this box below."
        value={formData.custom_questions}
        onChange={value =>
          setFormData(d => ({ ...d, custom_questions: value }))
        }
        placeholder="Enter question"
        addButtonText="+ Add question"
      />

      <div className="mb-2 md:mb-6">
        <h3 className="font-semibold text-sm md:text-base mb-2">
          Requirements
        </h3>
        <div className="flex items-center space-x-3 mb-4">
          <Switch
            checked={formData.requires_motivation_letter}
            onCheckedChange={checked =>
              setFormData(d => ({ ...d, requires_motivation_letter: checked }))
            }
            className="data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-200"
          />
          <label className="text-xs md:text-sm font-medium">
            Require motivation letter from applicants for this position
          </label>
        </div>
      </div>

      <div className="flex justify-between items-center flex-col pt-2 md:pt-6 space-y-2 md:space-y-4 border-t">
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

              // Validate required fields using generic validation utility
              const validationRules = [
                createValidationRules.required(
                  "title",
                  filteredData.title.trim()
                ),
                createValidationRules.required(
                  "description",
                  filteredData.description.trim()
                ),
                createValidationRules.arrayNotEmpty(
                  "required skill",
                  filteredData.required_skills,
                  "At least one required skill must be provided"
                ),
                createValidationRules.arrayNotEmpty(
                  "desirable skill",
                  filteredData.desirable_skills,
                  "At least one desirable skill must be provided"
                ),
              ];

              if (!validateAndShowErrors(validationRules)) {
                return;
              }

              clearSavedFormData();
              const cleanedData = {
                ...filteredData,
                requires_motivation_letter: formData.requires_motivation_letter,
              };
              onSave(cleanedData);
            }}
            className="bg-blue-400 text-xs md:text-sm"
          >
            Save
          </Button>
          <Button
            onClick={() => {
              clearSavedFormData();
              onCancel();
            }}
            variant="destructive"
            className="text-xs md:text-sm"
          >
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
