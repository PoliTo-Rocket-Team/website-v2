import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import SignInPage from "@/components/sign-in";

export default async function Login(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  return (
    <div className="flex-1 flex flex-col min-w-64">
      <h1 className="text-2xl font-medium">Sign in</h1>
      
      <div className="flex flex-col gap-2 [&>input]:mb-3 mt-8">
        <div className="flex justify-between items-center">
        </div>
        <SignInPage />
        
      </div>
    </div>
  );
}
