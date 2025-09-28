"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AutoGrowTextarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApplyPosition } from "@/app/actions/types";
import { localStorageUtils } from "@/lib/localStorage";
import { validateAndShowErrors, createValidationRules } from "@/lib/validation";
import { ArrayField } from "@/components/ui/array-field";
import { Database } from "@/types/supabase";
import { Prettify } from "@/lib/utils";

// component-specific Division type with only necessary fields
type Division = Prettify<
  Pick<Database["public"]["Tables"]["divisions"]["Row"], "id" | "name"> & {
    code: string; 
    departments:
      | Prettify<
          Pick<
            Database["public"]["Tables"]["departments"]["Row"],
            "id" | "name"
          > & {
            code: string; 
          }
        >[]
      | null;
  }
>;

interface AddPositionDialogProps {
  onAddPosition: (data: {
    title: string;
    description: string;
    required_skills: string[];
    desirable_skills: string[];
    custom_questions: string[];
    requires_motivation_letter: boolean;
    division_id: number;
  }) => Promise<ApplyPosition>;
  divisions: Division[];
  children: React.ReactNode;
}

export function AddPositionDialog({
  onAddPosition,
  divisions,
  children,
}: AddPositionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  const defaultFormData = {
    title: "",
    description: "",
    required_skills: [""],
    desirable_skills: [""],
    custom_questions: [""],
    requires_motivation_letter: false,
    division_id: 0,
  };

  const [formData, setFormData] = useState(defaultFormData);

  // Load data from localStorage on component mount
  useEffect(() => {
    if (!hasLoadedFromStorage) {
      const savedFormData = localStorageUtils.load(
        "addPositionDialog_formData",
        defaultFormData
      );
      if (savedFormData) {
        setFormData(savedFormData);
      }
      setHasLoadedFromStorage(true);
    }
  }, [hasLoadedFromStorage]);

  // Save form data to localStorage whenever it changes (but only after initial load)
  useEffect(() => {
    if (hasLoadedFromStorage) {
      // Only save if there's meaningful data to avoid saving empty defaults
      const hasData =
        formData.title ||
        formData.description ||
        formData.division_id > 0 ||
        formData.required_skills.some(skill => skill.trim()) ||
        formData.desirable_skills.some(skill => skill.trim()) ||
        formData.custom_questions.some(q => q.trim()) ||
        formData.requires_motivation_letter;

      if (hasData) {
        localStorageUtils.save("addPositionDialog_formData", formData);
      }
    }
  }, [formData, hasLoadedFromStorage]);

  // Load dialog state from localStorage on component mount
  useEffect(() => {
    const savedDialogState = localStorageUtils.load(
      "addPositionDialog_open",
      false
    );
    if (savedDialogState) {
      setOpen(true);
    }
  }, []);

  // Save dialog state to localStorage whenever it changes
  useEffect(() => {
    localStorageUtils.save("addPositionDialog_open", open);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Filter out empty entries
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
        createValidationRules.required("title", filteredData.title.trim()),
        createValidationRules.required(
          "description",
          filteredData.description.trim()
        ),
        createValidationRules.selection(
          "division",
          filteredData.division_id,
          "Please select a division"
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

      await onAddPosition(filteredData);

      // Reset form and close dialog
      resetForm();
      setOpen(false);

      toast.success("Position created successfully", {
        description: `"${filteredData.title}" has been added`,
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to create position:", error);
      toast.error("Failed to create position", {
        description:
          error instanceof Error
            ? error.message
            : "Please try again or contact support if the problem persists.",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(defaultFormData);
    localStorageUtils.remove("addPositionDialog_formData");
    localStorageUtils.remove("addPositionDialog_open");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm md:text-lg font-semibold text-center">
            Add New Position
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="">
          {divisions.length === 1 ? (
            // Show selected division as read-only text when there's only one
            <>
              <h3 className="font-semibold text-sm md:text-lg mb-2">Division</h3>
              <div className="w-full p-2 border rounded mb-2 md:mb-4 text-xs md:text-sm">
                {divisions[0].departments && divisions[0].departments.length > 0
                  ? `${divisions[0].departments[0].name} - ${divisions[0].name}`
                  : divisions[0].name}
              </div>
            </>
          ) : (
            // Show division selection dropdown when there are multiple divisions
            <>
              <h3 className="font-semibold text-sm md:text-lg mb-2">Division *</h3>
              <Select
                value={
                  formData.division_id === 0
                    ? ""
                    : formData.division_id.toString()
                }
                onValueChange={value =>
                  setFormData(prev => ({
                    ...prev,
                    division_id: parseInt(value),
                  }))
                }
              >
                <SelectTrigger className="w-full text-xs md:text-sm mb-4">
                  <SelectValue placeholder="Select a division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Divisions</SelectLabel>
                    {divisions.map(division => (
                      <SelectItem
                        key={division.id}
                        value={division.id.toString()}
                      >
                        {division.departments && division.departments.length > 0
                          ? `${division.departments[0].name} - ${division.name}`
                          : division.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </>
          )}

          <h3 className="font-semibold text-lg mb-2">Title *</h3>
          <AutoGrowTextarea
            className="flex-1 border rounded p-2 mb-2 md:mb-4 w-full"
            value={formData.title}
            onChange={e =>
              setFormData(prev => ({ ...prev, title: e.target.value }))
            }
            placeholder="e.g., Software Engineer"
          />

          <h3 className="font-semibold text-lg mb-2">Description *</h3>
          <AutoGrowTextarea
            className="w-full border px-2 py-1 rounded mb-2 md:mb-4 resize-none overflow-hidden min-h-[120px]"
            value={formData.description}
            onChange={e =>
              setFormData(prev => ({ ...prev, description: e.target.value }))
            }
            placeholder="Describe the position, responsibilities, and requirements..."
          />

          <ArrayField
            title="Required Skills"
            required
            value={formData.required_skills}
            onChange={value =>
              setFormData(prev => ({ ...prev, required_skills: value }))
            }
            placeholder="Enter required skill"
            addButtonText="+ Add required skill"
          />

          <ArrayField
            title="Desirable Skills"
            required
            value={formData.desirable_skills}
            onChange={value =>
              setFormData(prev => ({ ...prev, desirable_skills: value }))
            }
            placeholder="Enter desirable skill"
            addButtonText="+ Add desirable skill"
          />

          <ArrayField
            title="Custom Questions"
            description="Default informations (CV, name, surname, email, major, graduation year, etc.) will be asked automatically. If you want to ask specific questions to applicants for this position, add them to this box below."
            value={formData.custom_questions}
            onChange={value =>
              setFormData(prev => ({ ...prev, custom_questions: value }))
            }
            placeholder="Enter question"
            addButtonText="+ Add question"
            className="mb-2 md:mb-4"
          />

          <div className="mb-4">
            <h3 className="font-semibold text-sm md:text-lg mb-2">Requirements</h3>
            <div className="flex items-center space-x-3 mb-2 md:mb-4">
              <Switch
                checked={formData.requires_motivation_letter}
                onCheckedChange={checked =>
                  setFormData(prev => ({
                    ...prev,
                    requires_motivation_letter: checked,
                  }))
                }
                className="data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-200"
              />
              <label className="text-sm md:text-lg font-medium">
                Require motivation letter from applicants for this position
              </label>
            </div>
          </div>

          <div className="flex justify-between items-center flex-col pt-6 space-y-4 border-t">
            <div className="text-xs text-muted-foreground text-center">
              💾 Form data is automatically saved as you type
            </div>
            <div className="flex justify-center space-x-4">
              <Button
                type="submit"
                variant="default"
                disabled={isSubmitting}
                className="bg-blue-400 text-sm md:text-lg"
              >
                {isSubmitting ? "Creating..." : "Create Position"}
              </Button>
              <Button
                type="button"
                onClick={resetForm}
                variant="outline"
                disabled={isSubmitting}
                className="text-xs md:text-sm"
              >
                Clear Form
              </Button>
              <Button
                type="button"
                onClick={() => setOpen(false)}
                variant="destructive"
                disabled={isSubmitting}
                className="text-xs md:text-sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
