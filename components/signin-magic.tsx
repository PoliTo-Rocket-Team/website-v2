"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/ui/icons";
import { toast } from "sonner";

type MagicLinkSignIn = typeof signIn & {
  magicLink?: (input: {
    email: string;
    callbackURL?: string;
    name?: string;
    newUserCallbackURL?: string;
    errorCallbackURL?: string;
  }) => Promise<{
    data?: {
      status: boolean;
    };
    error?: {
      message?: string;
    };
  }>;
};

const magicLinkSignIn = signIn as MagicLinkSignIn;

export default function SignInMagic() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.warning("Oops! Email can't be empty.", {
        description: "Please enter your email address to continue.",
      });
      return;
    }

    setIsLoading(true);
    try {
      if (!magicLinkSignIn.magicLink) {
        toast.message("Magic link flow not connected yet.", {
          description: "Enable the Better Auth magic-link plugin to use this.",
        });
        return;
      }

      const result = await magicLinkSignIn.magicLink({
        email,
      });

      if (result?.error) {
        toast.error("Failed to send login link.", {
          description:
            result.error.message ||
            "We couldn’t send a magic link to your inbox. Try again.",
        });
      } else {
        toast.success("Magic link sent 🎉", {
          description: "Check your inbox to securely log in.",
        });
        setEmail("");
      }
    } catch (error) {
      toast.error("Unexpected error occurred", {
        description: "Something went wrong. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-2=">
        <Input
          id="email-magic"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onInvalid={e => {
            // @ts-ignore: allow custom message
            e.target.setCustomValidity("Please enter a valid email address.");
          }}
          onInput={e => {
            // @ts-ignore
            e.target.setCustomValidity("");
          }}
          disabled={isLoading}
          required
          className="w-full text-center"
          aria-describedby="email-description"
        />
        <p
          id="email-description"
          className="text-xs text-muted-foreground text-center my-2"
        >
          You'll receive a magic link to sign in instantly.
        </p>
      </div>

      <Button type="submit" className="w-full my-6">
        {isLoading && (
          <Icons.spinner
            className="mr-2 h-4 w-4 animate-spin"
            aria-hidden="true"
          />
        )}
        {isLoading ? "Sending link..." : "Sign in with Email"}
      </Button>
    </form>
  );
}
