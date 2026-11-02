"use client";

import { useState } from "react";
import { CircleCheck, Merge, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { LINK_FAILED, mayRemove, unlinkErrorMessage, type GoogleAccountsNotice, type LinkedGoogleAccount } from "@/lib/dashboard/google-accounts";
import { LOGIN_MERGE_REFUSAL_MESSAGES, MERGE_TICKET_STATE_KEY } from "@/lib/dashboard/login-merge";
import { Card } from "./account-parts";
import { ConfirmDialog } from "./confirm-dialog";
import { GHOST_PILL } from "./page-header";

/** A refusal shown in the card, with no merge to offer. */
const refusal = (message: string): GoogleAccountsNotice => ({ tone: "refused", message, offersMerge: false });

/**
 * The "Google accounts" section of My profile and My account (issue #906):
 * every Google account the person signs in with, by email, oldest first.
 * "Add another Google account" sends them through Google's own sign-in, which
 * proves they hold it, and back to `returnTo`; Remove asks first, and the last
 * account has none (lib/dashboard/google-accounts.ts). View as draws the page
 * as the person sees it (issue #653), and the server refuses every change
 * there; the refusal shows here. `notice` is what the return from Google came
 * to, already in words; null when there was none.
 *
 * When the added Google account already has its own login, the notice offers
 * to merge that login (issue #907): after a confirm step, the person signs in
 * with that Google account once more, carrying a merge ticket, and comes back
 * here with the merge done or refused (lib/login-merge-plugin.ts).
 */
export function GoogleAccountsCard({
  accounts: stored,
  returnTo,
  notice: returned,
  onRemoved,
}: {
  accounts: readonly LinkedGoogleAccount[];
  returnTo: string;
  notice: GoogleAccountsNotice | null;
  /**
   * Called once a removal lands. Removing the account whose email is the
   * sign-in email moves that email (issue #949), so the page reads its data
   * again and its Sign-in card shows the new one.
   */
  onRemoved: () => void;
}) {
  // The list lives in this card once a removal answers; nothing else on the page reads it.
  const [accounts, setAccounts] = useState(stored);
  const [notice, setNotice] = useState(returned);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<LinkedGoogleAccount | null>(null);
  const [confirmingMerge, setConfirmingMerge] = useState(false);
  const [pending, setPending] = useState(false);

  const add = async () => {
    setAdding(true);
    setNotice(null);
    try {
      // On success the browser leaves for Google; only a refusal comes back here.
      const { error: refused } = await authClient.linkSocial({ provider: "google", callbackURL: returnTo, errorCallbackURL: returnTo });
      if (refused) {
        setNotice(refusal(refused.message ?? LINK_FAILED));
        setAdding(false);
      }
    } catch {
      setNotice(refusal(LINK_FAILED));
      setAdding(false);
    }
  };

  const merge = async () => {
    setPending(true);
    try {
      const ticketed = await authClient.$fetch<{ ticket: string }>("/google-accounts/merge-ticket", { method: "POST" });
      if (ticketed.error || !ticketed.data) {
        setNotice(refusal(ticketed.error?.message ?? LOGIN_MERGE_REFUSAL_MESSAGES.failed));
      } else {
        // On success the browser leaves for Google; only a refusal comes back here.
        const { error: refused } = await authClient.signIn.social({
          provider: "google",
          callbackURL: returnTo,
          errorCallbackURL: returnTo,
          additionalData: { [MERGE_TICKET_STATE_KEY]: ticketed.data.ticket },
        });
        if (!refused) return;
        setNotice(refusal(refused.message ?? LOGIN_MERGE_REFUSAL_MESSAGES.failed));
      }
    } catch {
      setNotice(refusal(LOGIN_MERGE_REFUSAL_MESSAGES.failed));
    }
    setConfirmingMerge(false);
    setPending(false);
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
      onRemoved();
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
      {notice !== null && (
        <div className="border-t border-hairline px-5 py-3.5 md:px-6">
          {notice.tone === "done" ? (
            <p role="status" className="flex items-start gap-2 text-[13px] leading-relaxed text-success">
              <CircleCheck aria-hidden className="mt-[3px] h-[14px] w-[14px] shrink-0" strokeWidth={1.75} />
              {notice.message}
            </p>
          ) : (
            <p role="alert" className="text-[13px] leading-relaxed text-danger">
              {notice.message}
            </p>
          )}
          {notice.offersMerge && (
            <button type="button" onClick={() => setConfirmingMerge(true)} className={`${GHOST_PILL} mt-3 h-10 w-full px-4 text-[14px] font-semibold md:w-auto`}>
              <Merge aria-hidden className="h-4 w-4" strokeWidth={2} />
              Merge that login into this account
            </button>
          )}
        </div>
      )}
      <div className={`px-5 py-4 md:px-6 ${accounts.length > 0 || notice !== null ? "border-t border-hairline" : ""}`}>
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
      <ConfirmDialog
        open={confirmingMerge}
        onOpenChange={(open) => !pending && setConfirmingMerge(open)}
        icon={<Merge className="h-[18px] w-[18px]" strokeWidth={1.75} />}
        title="Merge that login into this account?"
        description="Its applications, their files and its Google accounts move to this account, and that login is closed. A login that holds another member's record is never merged. Google asks you to sign in with that Google account to confirm it is yours."
        cancelLabel="Not now"
        confirmLabel="Continue to Google"
        pending={pending}
        onConfirm={merge}
      />
    </Card>
  );
}
