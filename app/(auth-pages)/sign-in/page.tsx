import SignInPage from "@/components/sign-in";

export default async function Login() {
  return (
    <div className="flex-1 flex flex-col min-w-64">
      <h1 className="text-2xl font-medium text-center">Sign in</h1>
      
      <div className="flex flex-col gap-2 [&>input]:mb-3 mt-8">
        <div className="flex justify-between items-center">
        </div>
        <SignInPage />
      </div>

    </div>
  );
}
