"use client";

import { useState } from "react";
import { Plus, Unlink } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { linkErrorMessage, mayRemove, unlinkErrorMessage, type LinkedGoogleAccount } from "@/lib/dashboard/google-accounts";
import { Card } from "./account-parts";
import { ConfirmDialog } from "./confirm-dialog";
import { GHOST_PILL } from "./page-header";

/**
 * The "Google accounts" section of My profile and My account (issue #906):
 * every Google account the person signs in with, by email, oldest first.
 * "Add another Google account" sends them through Google's own sign-in, which
 * proves they hold it, and back to `returnTo`; Remove asks first, and the last
 * account has none (lib/dashboard/google-accounts.ts). View as draws the page
 * as the person sees it (issue #653), and the server refuses both changes
 * there; the refusal shows here. `linkError` is what Google's return said
 * went wrong, already in words; null when nothing did.
 */
export function GoogleAccountsCard({
  accounts: stored,
  returnTo,
  linkError,
}: {
  accounts: readonly LinkedGoogleAccount[];
  returnTo: string;
  linkError: string | null;
}) {
  // The list lives in this card once a removal answers; nothing else on the page reads it.
  const [accounts, setAccounts] = useState(stored);
  const [error, setError] = useState(linkError);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<LinkedGoogleAccount | null>(null);
  const [pending, setPending] = useState(false);

  const add = async () => {
    setAdding(true);
    setError(null);
    try {
      // On success the browser leaves for Google; only a refusal comes back here.
      const { error: refused } = await authClient.linkSocial({ provider: "google", callbackURL: returnTo, errorCallbackURL: returnTo });
      if (refused) {
        setError(refused.message ?? linkErrorMessage("unknown"));
        setAdding(false);
      }
    } catch {
      setError(linkErrorMessage("unknown"));
      setAdding(false);
    }
  };

  const remove = async () => {
    if (removing === null) return;
    setPending(true);
    try {
      const { error: refused } = await authClient.unlinkAccount({ providerId: "google", accountId: removing.googleId });
      if (refused) {
        toast.error("Could not remove the Google account", { description: unlinkErrorMessage(refused.message) });
        return;
      }
      setAccounts((now) => now.filter((account) => account.id !== removing.id));
      setRemoving(null);
      toast.success("Google account removed");
    } catch {
      toast.error("Could not remove the Google account", { description: unlinkErrorMessage(null) });
    } finally {
      setPending(false);
    }
  };

  return (
    <Card title="Google accounts" detail="Sign in with any of these. Each one opens this account.">
      {accounts.length > 0 && (
        <ul className="divide-y divide-hairline">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-3.5 px-5 py-4 md:px-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white-5">
                {/* Google's own mark, in its own colours (brand rule), as on the sign-in button. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/google-g.svg" alt="" width={16} height={16} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{account.email ?? "Google account"}</span>
              {mayRemove(accounts, account) && (
                <button
                  type="button"
                  onClick={() => setRemoving(account)}
                  aria-label={`Remove ${account.email ?? "this Google account"}`}
                  className={GHOST_PILL}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error !== null && (
        <p role="alert" className="border-t border-hairline px-5 py-3.5 text-[13px] leading-relaxed text-danger md:px-6">
          {error}
        </p>
      )}
      <div className={`px-5 py-4 md:px-6 ${accounts.length > 0 || error !== null ? "border-t border-hairline" : ""}`}>
        <button type="button" onClick={add} disabled={adding} aria-busy={adding} className={`${GHOST_PILL} h-10 w-full px-4 text-[14px] font-semibold md:w-auto`}>
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Add another Google account
        </button>
      </div>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        icon={<Unlink className="h-[18px] w-[18px]" strokeWidth={1.75} />}
        title="Remove this Google account?"
        description={`You will no longer sign in with ${removing?.email ?? "this Google account"}. Your other Google accounts keep working.`}
        cancelLabel="Keep it"
        confirmLabel="Remove"
        danger
        pending={pending}
        onConfirm={remove}
      />
    </Card>
  );
}
