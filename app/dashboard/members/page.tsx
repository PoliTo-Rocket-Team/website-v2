import { InfoIcon } from "lucide-react";
import { MembersList } from "@/components/members-list";

export default async function MembersPage() {
  return (
    <div>
      <div className="w-full">
        <div className="bg-accent text-sm p-3 px-5 rounded-md text-foreground flex gap-3 items-center">
          <InfoIcon size="16" strokeWidth={2} />
          This is a protected page that you can only see as an authenticated
          user
        </div>
        <MembersList />
      </div>
    </div>
  );
}
