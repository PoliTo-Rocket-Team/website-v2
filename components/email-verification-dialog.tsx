"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle } from "lucide-react";

interface EmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onClose?: () => void;
}

export function EmailVerificationDialog({
  open,
  onOpenChange,
  email,
  onClose,
}: EmailVerificationDialogProps) {
  const handleClose = () => {
    onOpenChange(false);
    onClose?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <AlertDialogTitle className="text-center text-2xl">
            Verify Your Email
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-4">
            <p>
              We sent a verification email to{" "}
              <strong className="text-foreground">{email}</strong>
            </p>
            <div className="rounded-lg bg-muted p-4 space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  Click the verification link in your email to activate your
                  account
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  Check your spam folder if you don't see it in your inbox
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          <Button onClick={handleClose} className="w-full">
            Got it!
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
