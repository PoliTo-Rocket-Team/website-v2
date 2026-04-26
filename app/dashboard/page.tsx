import { Suspense } from "react";
import { InfoIcon } from "lucide-react";
import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";

async function SessionDetails() {
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
  });

  return (
    <div className="flex flex-col gap-2 items-center">
      <h2 className="font-bold text-2xl mb-4">Your user details</h2>
      <pre className="bg-card border rounded-lg p-6 max-w-2xl w-full overflow-auto">
        <code className="text-sm">{JSON.stringify(session, null, 2)}</code>
      </pre>
    </div>
  );
}

function SessionDetailsFallback() {
  return (
    <div className="flex flex-col gap-2 items-center">
      <h2 className="font-bold text-2xl mb-4">Your user details</h2>
      <div className="bg-card border rounded-lg p-6 max-w-2xl w-full space-y-3">
        <div className="h-4 rounded bg-muted/50" />
        <div className="h-4 rounded bg-muted/50" />
        <div className="h-4 rounded bg-muted/50 w-3/4" />
      </div>
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-12 mt-10">
      <div className="w-full">
        <div className="bg-accent text-sm p-3 px-5 rounded-md text-foreground flex gap-3 items-center">
          <InfoIcon size="16" strokeWidth={2} />
          This is a protected page that you can only see as an authenticated
          user
        </div>
      </div>
      <Suspense fallback={<SessionDetailsFallback />}>
        <SessionDetails />
      </Suspense>
    </div>
  );
}
