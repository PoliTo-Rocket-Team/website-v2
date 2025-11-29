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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PositionEditForm } from "@/components/position-edit-form";
import Link from "next/link";
import { getApplyUrl } from "@/lib/utils";
import { ShinyButton } from "@/components/ui/shiny-button";

type PositionCardProps = {
  position: ApplyPosition;
  isOpen: boolean;
  onToggleAccordion: (id: string, isOpen: boolean) => void;
  onToggleStatus?: (id: number, currentStatus: boolean) => void;
  onDelete?: (id: number) => void;
  onEdit?: (id: number, data: any) => void;
  onAdd?: (position: ApplyPosition) => void;
  disclaimer?: string;
};

export function PositionCard({
  position,
  isOpen,
  onToggleAccordion,
  onToggleStatus,
  onDelete,
  onEdit,
  disclaimer,
}: PositionCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Load editing state from localStorage
  useEffect(() => {
    const editingPositionId = localStorage.getItem("editingPositionId");
    if (editingPositionId === position.id.toString()) {
      setIsEditing(true);
    }
  }, [position.id]);

  // Save editing state to localStorage
  useEffect(() => {
    if (isEditing) {
      localStorage.setItem("editingPositionId", position.id.toString());
    } else {
      const currentEditingId = localStorage.getItem("editingPositionId");
      if (currentEditingId === position.id.toString()) {
        localStorage.removeItem("editingPositionId");
      }
    }
  }, [isEditing, position.id]);

  const handleToggleStatus = () => {
    if (onToggleStatus) {
      onToggleStatus(position.id, position.status);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(position.id);
    }
  };

  const handleSaveEdit = (formData: any) => {
    if (onEdit) {
      onEdit(position.id, formData);
      setIsEditing(false);
    }
  };

  const renderSkillsList = (
    skills: string[] | null | undefined,
    title: string
  ) => (
    <>
      <h4 className="font-semibold text-base md:text-lg mb-1">{title}</h4>
      <ul className="list-disc list-outside pl-4 md:pl-5 mb-2 md:mb-10 text-xs md:text-sm">
        {skills?.map((skill, i) => (
          <li key={i} className="mb-1">
            {skill}
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <Accordion
      type="multiple"
      value={isOpen ? [position.id.toString()] : []}
      onValueChange={values => {
        const wasOpen = isOpen;
        const isNowOpen = values.includes(position.id.toString());
        if (wasOpen !== isNowOpen) {
          onToggleAccordion(position.id.toString(), isNowOpen);
        }
      }}
      className={`rounded-lg shadow-md border ${
        position.status ? "border-orange-600" : "border-border"
      }`}
    >
      <AccordionItem value={position.id.toString()}>
        <AccordionTrigger className="w-full border-b data-[state=closed]:rounded-lg data-[state=open]:rounded-t-lg p-2 md:px-2 md:py-4 hover:bg-secondary bg-clip-padding duration-100 transition-colors">
          <div className="flex flex-col items-start md:items-center flex-1 gap-2 md:grid w-full md:grid-cols-[3fr_2fr_auto] md:justify-items-start">
            <span className="font-semibold text-sm md:text-lg ">
              {position.title}
            </span>
            <span className="text-sm md:text-base font-medium ">
              {position.div_name}
            </span>
            {/* //! todo better way to change position state, switch inside accordion trigger is not ideal */}
            {position.canEdit && (
              <Switch
                checked={position.status}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                onCheckedChange={handleToggleStatus}
                className="data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-200 "
              />
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="p-2 md:p-6">
          {isEditing ? (
            <PositionEditForm
              position={position}
              onSave={handleSaveEdit}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              <h3 className="font-semibold text-base md:text-lg mb-2">
                Description
              </h3>
              <pre className="mb-2 md:mb-10 whitespace-pre-wrap font-sans text-xs md:text-sm leading-relaxed">
                {position.description}
              </pre>

              {renderSkillsList(position.required_skills, "Required Skills")}
              {renderSkillsList(position.desirable_skills, "Desirable Skills")}

              {position.canEdit !== undefined &&
                position.custom_questions &&
                position.custom_questions.length > 0 && (
                  <>
                    <h4 className="font-semibold text-base md:text-lg mb-1">
                      Custom Questions
                    </h4>
                    <ul className="list-disc list-outside pl-4 md:pl-5 mb-2 md:mb-10 text-xs md:text-sm">
                      {position.custom_questions?.map((q, i) => (
                        <li key={i} className="mb-1">
                          {q}
                        </li>
                      ))}
                    </ul>
                    <div className="mb-2 md:mb-10">
                      <h4 className="font-semibold text-base md:text-lg  mb-1">
                        Application Requirements
                      </h4>
                      <div className="flex items-center space-x-2 pl-2">
                        <div
                          className={`w-2 h-2 rounded-full ${(position as any).requires_motivation_letter ? "bg-orange-600" : "bg-gray-300"}`}
                        ></div>
                        <span className="text-xs md:text-sm">
                          Motivation letter{" "}
                          {(position as any).requires_motivation_letter
                            ? "required"
                            : "not required"}
                        </span>
                      </div>
                    </div>
                  </>
                )}

              <div
                className={`flex justify-between items-center flex-col pt-2 md:pt-6 ${
                  position.canEdit ? "space-y-4" : "space-y-0"
                } border-t`}
              >
                <div className="flex justify-center space-x-4">
                  {position.canEdit && (
                    <>
                      <Button
                        onClick={() => setIsEditing(true)}
                        variant="outline"
                        className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                      >
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive">Delete</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Are you absolutely sure?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will
                              permanently delete the position "{position.title}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDelete}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete Position
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
                {position.status &&
                position.dept_code &&
                position.div_code ? (
                  <Link href={getApplyUrl(position)} className="inline-block">
                    <ShinyButton className="m-0">Apply</ShinyButton>
                  </Link>
                ) : null}
                {disclaimer && (
                  <div className="flex justify-center pt-2 md:pt-4 px-4 ">
                    <p className="text-xs text-muted-foreground text-center">
                      Please be informed that your work will be entirely
                      voluntary. As we are a student team of Politecnico di
                      Torino, we do not offer any paid employment.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
