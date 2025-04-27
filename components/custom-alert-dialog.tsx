"use client";
import { Button } from "./ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export function CustomAlertDialog({
  destructiveButton,
  value,
}: {
  value: { name: string | null};
  destructiveButton: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className="m-5" variant="destructive">
          {destructiveButton}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete{" "}
            {value.name}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              toast.success(`${value.name} deleted`, {
                description: 'The item has been removed',
                action: {
                  label: "Undo",
                  onClick: () => {
                    toast.info(`${value.name} restored`);
                  },
                },
              });
            }}
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export default CustomAlertDialog;
