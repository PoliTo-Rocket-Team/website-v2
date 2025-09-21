import { Metadata } from "next";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { Separator } from "@/components/ui/separator";
import SignInWithGoogle from "@/components/signin-google";
import SignInMagic from "@/components/signin-magic";

export const metadata: Metadata = {
  title: "Login | Polito Rocket Team",
  description: "Login to your account",
};

export default async function Login() {
  return (
    <div className="flex flex-col h-screen items-center justify-center ">
      <div className="mx-auto flex w-full my-auto flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          
          {/* //! Add Icons.logo */}
          <Icons.logo className="mx-auto h-16 w-16" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Continue with your account
          </p>
        </div>

        <SignInWithGoogle />
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground my-2">
          <Separator className="flex-1 ml-2" />
          <span className="whitespace-nowrap">or</span>
          <Separator className="flex-1 mr-2" />
        </div>

        <SignInMagic />

        <p className="px-4 text-center text-sm text-muted-foreground">
          By signing in, you agree to our{" "}
          {/* //! terms and conditions page to be added */}
          <Link
            href="/terms"
            className="hover:text-brand underline underline-offset-4"
          >
            Terms of Service
          </Link>{" "}
          and {/* //! privacy policy page to be added */}
          <Link
            href="/privacy"
            className="hover:text-brand underline underline-offset-4"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
