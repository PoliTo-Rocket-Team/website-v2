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
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/icons";
import { toast } from "sonner";
import { z } from "zod";
import { useState, useEffect } from "react";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldGroup,
} from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email?: string;
}

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export function ForgotPasswordDialog({
  open,
  onOpenChange,
  email: initialEmail = "",
}: ForgotPasswordDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [emailSent, setEmailSent] = useState(false);

  // Sync email state when dialog opens or initialEmail changes
  useEffect(() => {
    if (open) {
      setEmail(initialEmail);
    }
  }, [open, initialEmail]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const result = forgotPasswordSchema.safeParse({ email });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(error => {
        if (error.path[0]) {
          fieldErrors[error.path[0] as string] = error.message;
        }
      });
      setErrors(fieldErrors);
      setIsLoading(false);
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      const { data, error } = await authClient.requestPasswordReset({
        email: result.data.email,
        redirectTo: "/reset-password",
      });

      if (error) {
        toast.error(error.message || "Failed to send reset email");
        setIsLoading(false);
        return;
      }

      toast.success("Password reset email sent!");
      setEmailSent(true);
      setIsLoading(false);
    } catch (error) {
      console.error("Password reset error:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setEmailSent(false);
      setEmail(initialEmail);
      setErrors({});
    }, 300);
  };

  if (emailSent) {
    return (
      <AlertDialog open={open} onOpenChange={handleClose}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Icons.mail className="h-6 w-6 text-green-600" />
            </div>
            <AlertDialogTitle className="text-center text-2xl">
              Check Your Email
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-4">
              <span className="block">
                We sent a password reset link to{" "}
                <strong className="text-foreground">{email}</strong>
              </span>
              <div className="rounded-lg bg-muted p-4 space-y-3 text-left">
                <div className="flex items-start gap-3">
                  <Icons.check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">
                    Click the link in your email to reset your password
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Icons.mail className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">
                    Check your spam folder if you don't see it in your inbox
                  </span>
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

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center text-2xl">
            Reset Your Password
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Enter your email address and we'll send you a link to reset your
            password
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reset-email">Email</FieldLabel>
              <Input
                id="reset-email"
                name="email"
                type="email"
                placeholder="m@example.com"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <FieldDescription className="text-destructive">
                  {errors.email}
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2 mt-4">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading}
              className="w-full"
            >
              Cancel
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
