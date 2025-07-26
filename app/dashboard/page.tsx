import { InfoIcon } from "lucide-react";
import { auth } from "@/auth";
export default async function ProtectedPage() {
  const session = await auth();

  return (
    <div className="flex-1 w-full flex flex-col gap-12 mt-10">
      <div className="w-full">
        <div className="bg-accent text-sm p-3 px-5 rounded-md text-foreground flex gap-3 items-center">
          <InfoIcon size="16" strokeWidth={2} />
          This is a protected page that you can only see as an authenticated
          user
        </div>
      </div>
      <div className="flex flex-col gap-2 items-center">
        <h2 className="font-bold text-2xl mb-4">Your user details</h2>
          {JSON.stringify(session?.email, null, 2)}
      </div>
    </div>
  );
}
