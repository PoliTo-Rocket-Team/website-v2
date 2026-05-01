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
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Icons } from "@/components/ui/icons";

interface EmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onClose?: () => void;
  showResendButton?: boolean;
  startCountdownOnOpen?: boolean;
}

interface ResendAttemptData {
  count: number;
  timestamp: number;
}

const STORAGE_KEY = "email_verification_resend_attempts";
const RESET_INTERVAL = 20 * 60 * 1000; // 20 minutes in milliseconds
const MAX_ATTEMPTS = 3;

const getStoredAttempts = (email: string): ResendAttemptData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { count: 0, timestamp: Date.now() };
    const allData: Record<string, ResendAttemptData> = JSON.parse(stored);
    const data = allData[email] || { count: 0, timestamp: Date.now() };
    const elapsed = Date.now() - data.timestamp;
    // Reset if 20 minutes have passed
    if (elapsed >= RESET_INTERVAL) {
      return { count: 0, timestamp: Date.now() };
    }
    return data;
  } catch {
    return { count: 0, timestamp: Date.now() };
  }
};

const saveAttempts = (email: string, count: number) => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let allData: Record<string, ResendAttemptData> = {};
    if (stored) {
      allData = JSON.parse(stored);
    }
    allData[email] = {
      count,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
  } catch (error) {
    console.error("Failed to save attempts to localStorage:", error);
  }
};

export function EmailVerificationDialog({
  open,
  onOpenChange,
  email,
  onClose,
  showResendButton = false,
  startCountdownOnOpen = false,
}: EmailVerificationDialogProps) {
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [attemptCount, setAttemptCount] = useState(
    () => getStoredAttempts(email).count
  );

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Check and reset attempts when dialog opens
  useEffect(() => {
    if (open) {
      const stored = getStoredAttempts(email);
      setAttemptCount(stored.count);
      // Only start countdown on open if explicitly requested (signup)
      if (showResendButton && startCountdownOnOpen && countdown === 0) {
        setCountdown(90);
      }
    }
  }, [open, startCountdownOnOpen, email]);

  const handleClose = () => {
    onOpenChange(false);
    onClose?.();
  };

  const handleResend = async () => {
    if (attemptCount >= MAX_ATTEMPTS) {
      toast.error("Maximum resend attempts reached. Please try again later.");
      return;
    }

    setIsResending(true);
    try {
      const { data, error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/dashboard",
      });

      if (error) {
        toast.error(error.message || "Failed to resend verification email");
      } else {
        toast.success("Verification email sent!");
        setCountdown(90);
        const newCount = attemptCount + 1;
        setAttemptCount(newCount);
        saveAttempts(email, newCount);
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsResending(false);
    }
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
            <span className="block">
              We sent a verification email to{" "}
              <strong className="text-foreground">{email}</strong>
            </span>
            <div className="rounded-lg bg-muted p-4 space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">
                  Click the verification link in your email to activate your
                  account
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">
                  Check your spam folder if you don't see it in your inbox
                </span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          <div className="flex flex-col gap-2 w-full">
            {showResendButton && (
              <Button
                onClick={handleResend}
                disabled={
                  isResending || countdown > 0 || attemptCount >= MAX_ATTEMPTS
                }
                variant="outline"
                className="w-full"
              >
                {isResending ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : attemptCount >= MAX_ATTEMPTS ? (
                  "Maximum attempts reached"
                ) : countdown > 0 ? (
                  `Resend in ${countdown}s`
                ) : (
                  "Resend verification email"
                )}
              </Button>
            )}
            {showResendButton &&
              attemptCount > 0 &&
              attemptCount < MAX_ATTEMPTS && (
                <span className="text-xs text-muted-foreground text-center block mt-1">
                  {MAX_ATTEMPTS - attemptCount}{" "}
                  {MAX_ATTEMPTS - attemptCount === 1 ? "attempt" : "attempts"}{" "}
                  remaining
                </span>
              )}
            {showResendButton && attemptCount >= MAX_ATTEMPTS && (
              <span className="text-xs text-muted-foreground text-center block mt-1">
                You have already sent multiple verification emails.
                <br />
                Please wait a few minutes and check your inbox and spam folder
                for the verification email.
                <br />
                If you still haven't received it, you can try again later.
              </span>
            )}
            <Button onClick={handleClose} className="w-full mt-1">
              Close
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
