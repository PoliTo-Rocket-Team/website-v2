"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName: string;
  fileType: "CV" | "ML";
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  fileUrl,
  fileName,
  fileType,
}: FilePreviewDialogProps) {
  const title =
    fileType === "CV" ? `CV - ${fileName}` : `Motivation Letter - ${fileName}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 [&>button]:!-right-4 [&>button]:!-top-4 [&>button]:!w-8 [&>button]:!h-8 [&>button]:!rounded-full [&>button]:!bg-background [&>button]:!border [&>button]:!border-border [&>button]:!shadow-lg [&>button>svg]:!text-foreground [&>button]:!opacity-100 [&>button]:!transition-all [&>button]:!duration-200 [&>button]:!flex [&>button]:!items-center [&>button]:!justify-center [&>button>svg]:!text-gray-600 [&>button>svg]:dark:!text-gray-300 [&>button>svg]:!w-4 [&>button>svg]:!h-4">
        <div className="flex flex-col h-full">
          <DialogHeader className="">
            <DialogTitle className="sr-only">{title}</DialogTitle>
          </DialogHeader>
          <embed
            src={fileUrl}
            type="application/pdf"
            className="w-full flex-1 border rounded"
            title={title}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
