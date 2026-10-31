"use client";

import { useState } from "react";
import type { YourDetails } from "@/lib/dashboard/details";
import { DELETE_ACCOUNT_COPY, type MyAccount } from "@/lib/dashboard/self";
import type { WriteResult } from "@/lib/dashboard/write";
import { DANGER_PILL, DangerBox, DangerRow, DeleteAccountDialog, SignInCard } from "./account-parts";
import { GoogleAccountsCard } from "./google-accounts";
import { PageHeader } from "./page-header";
import { YourDetailsCard } from "./your-details";

type Actions = {
  saveDetails: (input: unknown) => Promise<WriteResult<YourDetails>>;
  deleteAccount: (withdrawOpenApplications: boolean, removeFromAlumni: boolean) => Promise<WriteResult<null>>;
};

// Board 51 (51m on phones): an applicant's own account. How they sign in, the
// Google accounts they sign in with (issue #906), "Your details", and Delete
// account. Their applications are on My applications. Props in, nothing
// fetched.
export function MyAccountView({
  account,
  linkError = null,
  ...actions
}: {
  account: MyAccount;
  /** What went wrong adding a Google account, in words, when Google sent the person back with an error (issue #906). */
  linkError?: string | null;
} & Actions) {
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <PageHeader title="My account" intro="Your sign-in and the details we keep for your applications." />
      <div className="mt-6 flex flex-col gap-5">
        <SignInCard account={account} />
        <GoogleAccountsCard accounts={account.googleAccounts} returnTo="/dashboard/account" linkError={linkError} />
        <YourDetailsCard details={account.details} editor="applicant" saveDetails={actions.saveDetails} />
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
        unwithdrawnApplications={account.unwithdrawnApplications}
        member={false}
        deleteAccount={actions.deleteAccount}
      />
    </>
  );
}
