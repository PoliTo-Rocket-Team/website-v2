"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { signUp } from "@/lib/auth-client";
import { Icons } from "@/components/icons";
import { toast } from "sonner";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { EmailVerificationDialog } from "@/components/email-verification-dialog";

const signupSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100, "Name is too long"),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character"
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get callback URL directly from searchParams
  const callbackUrl = searchParams.get("cb") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirm-password") as string,
    };

    // Validate with Zod
    const result = signupSchema.safeParse(data);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};

      if (result.error?.issues) {
        result.error.issues.forEach(error => {
          if (error.path[0]) {
            fieldErrors[error.path[0] as string] = error.message;
          }
        });
      }

      setErrors(fieldErrors);
      setIsLoading(false);
      toast.error("Please fix the errors in the form");
      return;
    }

    try {
      await signUp.email(
        {
          email: result.data.email,
          password: result.data.password,
          name: result.data.name,
          callbackURL: callbackUrl,
        },
        {
          onSuccess: () => {
            setIsLoading(false);
            toast.success("Account created successfully!");
            setUserEmail(result.data.email);
            setShowVerificationDialog(true);
          },
          onError: ctx => {
            setIsLoading(false);
            // Handle specific errors
            if (ctx.error.status === 403) {
              // Email not verified
              setUserEmail(result.data.email);
              setShowVerificationDialog(true);
            } else if (
              ctx.error.status === 422 ||
              ctx.error.message?.includes("already exists")
            ) {
              toast.error(
                "This email is already registered. Please login instead."
              );
            } else {
              toast.error(
                ctx.error.message ||
                  "Failed to create account. Please try again."
              );
            }
          },
        }
      );
    } catch (error) {
      console.error("Unexpected signup error:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  disabled={isLoading}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <FieldDescription className="text-destructive">
                    {errors.name}
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="me@example.com"
                  disabled={isLoading}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <FieldDescription className="text-destructive">
                    {errors.email}
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <Field className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      disabled={isLoading}
                      className={errors.password ? "border-destructive" : ""}
                    />
                    {errors.password && (
                      <FieldDescription className="text-destructive">
                        {errors.password}
                      </FieldDescription>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirm-password">
                      Confirm Password
                    </FieldLabel>
                    <Input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      disabled={isLoading}
                      className={
                        errors.confirmPassword ? "border-destructive" : ""
                      }
                    />
                    {errors.confirmPassword && (
                      <FieldDescription className="text-destructive">
                        {errors.confirmPassword}
                      </FieldDescription>
                    )}
                  </Field>
                </Field>
                <FieldDescription>
                  Must be at least 8 characters with uppercase, lowercase,
                  number, and special character.
                </FieldDescription>
              </Field>
              <Field>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
                <FieldDescription className="text-center">
                  Already have an account?{" "}
                  <Link
                    href={`/login${callbackUrl !== "/dashboard" ? `?cb=${encodeURIComponent(callbackUrl)}` : ""}`}
                  >
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      {/*  //! todo -- Terms of Service and Privacy Policy --- // */}
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>

      <EmailVerificationDialog
        open={showVerificationDialog}
        onOpenChange={setShowVerificationDialog}
        email={userEmail}
        showResendButton={true}
        startCountdownOnOpen={true}
      />
    </div>
  );
}
