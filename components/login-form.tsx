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
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { signIn } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { toast } from "sonner";
import { EmailVerificationDialog } from "@/components/email-verification-dialog";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [callbackUrl, setCallbackUrl] = useState<string>("/dashboard");

  useEffect(() => {
    const callback = searchParams.get("cb") || "/dashboard";
    setCallbackUrl(callback);
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: callbackUrl,
      });
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      toast.error(
        "Failed to sign in with Google: " +
          (err?.message || "Please try again.")
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsEmailLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    // Validate with Zod
    const result = loginSchema.safeParse(data);

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
      setIsEmailLoading(false);
      toast.error("Please fix the errors in the form");
      return;
    }

    try {
      const response = await signIn.email({
        email: result.data.email,
        password: result.data.password,
        callbackURL: callbackUrl,
      });

      // Check if sign-in was successful
      if (response.error) {
        // Handle specific errors
        if (response.error.status === 401) {
          toast.error("Invalid email or password");
        } else if (
          response.error.message?.includes("not verified") ||
          response.error.message?.includes("verify")
        ) {
          setUserEmail(result.data.email);
          setShowVerificationDialog(true);
        } else {
          toast.error(
            response.error.message || "Failed to sign in. Please try again."
          );
        }
        return;
      }

      toast.success("Signed in successfully!");
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Sign-in error:", err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl p-2">Welcome </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailSignIn}>
            <FieldGroup>
              <Field>
                <div className="relative group">
                  <Button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading || isEmailLoading}
                    className="w-full"
                  >
                    {isGoogleLoading ? (
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Icons.google className="mr-2 h-4 w-4" />
                    )}
                    Continue with Google
                  </Button>
                  <span className="absolute -top-3 -left-3 text-[10px] bg-primary px-1.5 py-0.5 rounded-md -rotate-[0deg] shadow-sm font-medium group-hover:opacity-0 transition-opacity">
                    Recommended
                  </span>
                </div>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="text"
                  placeholder="m@example.com"
                  disabled={isEmailLoading || isGoogleLoading}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <FieldDescription className="text-destructive">
                    {errors.email}
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  {/* //! todo -- forgot password link --- // */}
                  <a
                    href="#"
                    className="ml-auto text-xs underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  disabled={isEmailLoading || isGoogleLoading}
                  className={errors.password ? "border-destructive" : ""}
                />
                {errors.password && (
                  <FieldDescription className="text-destructive">
                    {errors.password}
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <Button
                  type="submit"
                  disabled={isEmailLoading || isGoogleLoading}
                >
                  {isEmailLoading ? (
                    <>
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account? <a href="/sign-up">Sign up</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      {/* //! todo -- Terms of Service and Privacy Policy --- // */}
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>

      <EmailVerificationDialog
        open={showVerificationDialog}
        onOpenChange={setShowVerificationDialog}
        email={userEmail}
      />
    </div>
  );
}
