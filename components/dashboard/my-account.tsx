"use client";

import { useState } from "react";
import { ACCOUNT_DETAIL_KEYS, type YourDetails } from "@/lib/dashboard/details";
import { DELETE_ACCOUNT_COPY, type MyAccount } from "@/lib/dashboard/self";
import type { ViewerSession } from "@/lib/dashboard/viewer";
import type { WriteResult } from "@/lib/dashboard/write";
import { DANGER_PILL, DangerBox, DangerRow, DeleteAccountDialog, SignInCard } from "./account-parts";
import { PageHeader } from "./page-header";
import { YourDetailsCard } from "./your-details";

type Actions = {
  saveDetails: (input: unknown) => Promise<WriteResult<YourDetails>>;
  deleteAccount: (withdrawOpenApplications: boolean) => Promise<WriteResult<null>>;
};

// Board 51 (51m on phones): an applicant's own account. How they sign in,
// "Your details", and Delete account. Their applications are on My
// applications. Props in, nothing fetched.
export function MyAccountView({ account, session, ...actions }: { account: MyAccount; session: ViewerSession } & Actions) {
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <PageHeader title="My account" intro="Your sign-in and the details we keep for your applications." />
      <div className="mt-6 flex flex-col gap-5">
        <SignInCard name={account.name} signIn={account.signIn} />
        <YourDetailsCard details={account.details} keys={ACCOUNT_DETAIL_KEYS} saveDetails={actions.saveDetails} />
        <DangerBox>
          <DangerRow title="Delete account" text={DELETE_ACCOUNT_COPY}>
            <button type="button" onClick={() => setDeleting(true)} className={`${DANGER_PILL} w-full md:w-auto`}>
              Delete account
            </button>
          </DangerRow>
        </DangerBox>
      </div>
      <DeleteAccountDialog
        open={deleting}
        onOpenChange={setDeleting}
        session={session}
        openApplications={account.openApplications}
        member={false}
        deleteAccount={actions.deleteAccount}
      />
    </>
  );
}
