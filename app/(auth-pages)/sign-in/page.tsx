import SignInPage from "@/components/sign-in";

export default async function Login() {
  return (
    <div className=" w-full flex flex-col mt-10">
      
      <h1 className="text-2xl font-medium text-center">Sign in</h1>
      
      <div className="flex flex-col gap-2 items-center [&>input]:mb-3 mt-8">
        <SignInPage />
      </div>

    </div>
  );
}
