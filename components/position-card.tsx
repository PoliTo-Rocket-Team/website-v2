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

type PositionCardProps = {
  position: ApplyPosition;
  isOpen: boolean;
  onToggleAccordion: (id: string, isOpen: boolean) => void;
  onToggleStatus?: (id: number, currentStatus: boolean) => void;
  onDelete?: (id: number) => void;
  onEdit?: (id: number, data: any) => void;
};

export function PositionCard({
  position,
  isOpen,
  onToggleAccordion,
  onToggleStatus,
  onDelete,
  onEdit,
}: PositionCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Load editing state from localStorage
  useEffect(() => {
    const editingPositionId = localStorage.getItem("editingPositionId");
    console.log(
      `Checking editing state for position ${position.id}, saved: ${editingPositionId}`
    );
    if (editingPositionId === position.id.toString()) {
      console.log(`Setting position ${position.id} to editing mode`);
      setIsEditing(true);
    }
  }, [position.id]);

  // Save editing state to localStorage
  useEffect(() => {
    if (isEditing) {
      console.log(`Saving editing state for position ${position.id}`);
      localStorage.setItem("editingPositionId", position.id.toString());
    } else {
      const currentEditingId = localStorage.getItem("editingPositionId");
      if (currentEditingId === position.id.toString()) {
        console.log(`Clearing editing state for position ${position.id}`);
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
      <h4 className="font-semibold text-sm mb-1">{title}</h4>
      <ul className="list-disc list-outside pl-5 mb-10">
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
        <AccordionTrigger className="flex justify-between items-center border-b data-[state=closed]:rounded-lg data-[state=open]:rounded-t-lg px-4 py-4 hover:bg-secondary bg-clip-padding duration-100 transition-colors">
          <span className="font-semibold text-lg">{position.title}</span>
          <div className="flex items-center ml-auto">
            <span className="text-medium font-medium">
              {position.dept_name} Department – {position.div_name} Division
              –&nbsp;
            </span>
            <span className="text-medium font-medium text-orange-600">
              {position.div_code}&nbsp;&nbsp;
            </span>
            {position.canEdit && (
              <Switch
                checked={position.status}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                onCheckedChange={handleToggleStatus}
                className="data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-gray-200"
              />
            )}
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-6 py-6">
          {isEditing ? (
            <PositionEditForm
              position={position}
              onSave={handleSaveEdit}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <>
              <h3 className="font-semibold text-lg mb-2">Description</h3>
              <pre className="mb-10 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {position.description}
              </pre>

              {renderSkillsList(position.required_skills, "Required Skills")}
              {renderSkillsList(position.desirable_skills, "Desirable Skills")}

              {/* // Custom questions content only visible if canEdit is defined
                // and there are custom questions */}
              {position.canEdit !== undefined &&
                position.custom_questions &&
                position.custom_questions.length > 0 && (
                  <>
                    <h4 className="font-semibold text-sm mb-1">
                      Custom Questions
                    </h4>
                    <ul className="list-disc list-outside pl-5 mb-10">
                      {position.custom_questions?.map((q, i) => (
                        <li key={i} className="mb-1">
                          {q}
                        </li>
                      ))}
                    </ul>
                    <div className="mb-10">
                      <h4 className="font-semibold text-sm mb-1">
                        Application Requirements
                      </h4>
                      <div className="flex items-center space-x-2 pl-2">
                        <div
                          className={`w-2 h-2 rounded-full ${(position as any).requires_motivation_letter ? "bg-orange-600" : "bg-gray-300"}`}
                        ></div>
                        <span className="text-sm">
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
                className={`flex justify-between items-center flex-col pt-6 ${
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
                              permanently delete the position "{position.title}"
                              and remove all associated data from our servers.
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
                <Button
                  asChild
                  variant="outline"
                  className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white m-0"
                >
                  <Link href="#">Apply</Link>
                </Button>
              </div>
            </>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
