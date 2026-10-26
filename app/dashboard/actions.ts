"use server";

import { revalidatePath } from "next/cache";
import { canReach, type DashboardLanding, type DashboardPageKey } from "@/lib/dashboard/access";
import type { DashboardData } from "@/lib/dashboard/data";
import type { YourDetails } from "@/lib/dashboard/details";
import type { AccessGrant } from "@/lib/dashboard/division-access";
import { isHandOverAnswer } from "@/lib/dashboard/hand-over-request";
import type { InterviewSlot } from "@/lib/dashboard/my-applications";
import { uploadOf } from "@/lib/dashboard/form-upload";
import { openDashboard } from "@/lib/dashboard/open";
import type { Order } from "@/lib/dashboard/orders";
import { refused, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { isPublishStep, type ContentItem, type PublishStep, type Versioned } from "@/lib/content/versioned";
import type { TeamPageLayer } from "@/lib/about/team-layer";
import type { TeamPageSaved } from "@/lib/about/team-page-editor";
import type { PersonPhoto } from "@/lib/about/types";
import type { Partner, PartnerTier } from "@/lib/partners";
import type { MeasuredLogo } from "@/lib/partners-editor";
import { PARTNER_FIELDS, type PartnerFields } from "@/lib/partners-fields";
import type { FaqFields, FaqVersion } from "@/lib/faq/faq";
import { readPostFields } from "@/lib/outreach-post-fields";
import type { OutreachTag, PhotoSrc, PostItem } from "@/lib/outreach-types";

// The dashboard's writes (issues #145 and #169). Each one opens the dashboard as the
// page did, checks the viewer reaches the page the write belongs to, and
// hands what the browser sent to the data interface, which checks it again
// and writes to the database.

/** The dashboard, when the viewer reaches one of `pages`; else why not. */
async function dataFor(pages: DashboardPageKey | readonly DashboardPageKey[]): Promise<DashboardData | string> {
  const opening = await openDashboard();
  if (opening.kind !== "open") return "Sign in again to make changes.";
  const { viewer } = opening.data;
  if (!(typeof pages === "string" ? [pages] : pages).some((page) => canReach(viewer, page))) return "You do not have this page.";
  return opening.data;
}

async function write<T>(
  pages: DashboardPageKey | readonly DashboardPageKey[],
  run: (data: DashboardData) => Promise<WriteResult<T>>,
): Promise<WriteResult<T>> {
  const data = await dataFor(pages);
  return typeof data === "string" ? refused(data) : run(data);
}

function textFields(form: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, String(form.get(name) ?? "")]));
}

/** Dismiss on a notice under "Needs your attention" (issue #201); the Overview reads again without it. */
export async function dismissNotice(noticeId: number): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(noticeId)) return refused("Unknown notice.");
  const result = await write("overview", (data) => data.dismissNotice(noticeId));
  if (result.ok) revalidatePath("/dashboard");
  return result;
}

/** Give access or Edit access (boards 60b and 60c). */
export async function saveAccess(input: unknown): Promise<WriteResult<readonly AccessGrant[]>> {
  return write("division-access", (data) => data.saveAccess(input));
}

export async function removeAllAccess(personId: number): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(personId)) return refused("Unknown person.");
  return write("division-access", (data) => data.removeAllAccess(personId));
}

/** Remove on one "Current access" row in Edit access (issue #483). */
export async function removeGrant(input: unknown): Promise<WriteResult<readonly AccessGrant[]>> {
  return write("division-access", (data) => data.removeGrant(input));
}

// `division` is the division a new order is for (issue #233); an edit keeps the order's own.
const ORDER_FIELDS = ["item", "link", "price", "quantity", "reason", "division"] as const;

export async function placeOrder(form: FormData): Promise<WriteResult<Order>> {
  const fields = textFields(form, ORDER_FIELDS);
  return write("orders", async (data) => data.placeOrder(fields, await uploadOf(form, "quote")));
}

/** Edit order, or Edit and send again (boards 61c and 61d). */
export async function editOrder(orderId: number, form: FormData): Promise<WriteResult<Order>> {
  if (!Number.isSafeInteger(orderId)) return refused("Unknown request.");
  const fields = textFields(form, ORDER_FIELDS);
  return write("orders", async (data) => data.editOrder(orderId, fields, await uploadOf(form, "quote")));
}

export async function cancelOrder(orderId: number): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(orderId)) return refused("Unknown request.");
  return write("orders", (data) => data.cancelOrder(orderId));
}

/**
 * Approve, Reject or Ask for changes (boards 70b, 70d and 70e), after the
 * page asked "are you sure". The data interface checks the decision with
 * `checkDecision` (lib/dashboard/orders.ts): the right to decide, a waiting
 * request, a note on Ask for changes.
 */
export async function decideOrder(orderId: number, decision: unknown): Promise<WriteResult<Order>> {
  if (!Number.isSafeInteger(orderId)) return refused("Unknown request.");
  return write("orders", (data) => data.decideOrder(orderId, decision));
}

/** Mark as ordered (board 70c), after the page asked "are you sure"; checked with `checkMarkOrdered`. */
export async function markOrdered(orderId: number): Promise<WriteResult<Order>> {
  if (!Number.isSafeInteger(orderId)) return refused("Unknown request.");
  return write("orders", (data) => data.markOrdered(orderId));
}

// The Partners page (boards 76 and 76b, issue #256). Each write also passes
// the site-content gate inside the data interface (lib/content/gate.ts).

/** The panel measures a picked logo, so it can pre-set "draw it white" and warn of a solid box before it is saved. */
export async function measurePartnerLogo(form: FormData): Promise<WriteResult<MeasuredLogo>> {
  const logo = await uploadOf(form, "logo");
  if (logo === null) return refused("Choose a logo.");
  return write("partners", (data) => data.partners.measure(logo));
}

/**
 * Save draft or Publish on a partner; `partnerId` null is New partner. The
 * form's `darkLogo` ("true" or "false") is the editor's "draw it white" choice.
 */
export async function savePartner(partnerId: number | null, step: PublishStep, form: FormData): Promise<WriteResult<ContentItem<Partner>>> {
  if (partnerId !== null && !Number.isSafeInteger(partnerId)) return refused("Unknown partner.");
  if (!isPublishStep(step)) return refused("Save a draft or publish.");
  const fields = textFields(form, PARTNER_FIELDS) as PartnerFields;
  const dark = form.get("darkLogo");
  const darkLogo = dark === "true" ? true : dark === "false" ? false : undefined;
  const result = await write("partners", async (data) => data.partners.save(partnerId, step, fields, await uploadOf(form, "logo"), darkLogo));
  if (result.ok) refreshPublicPartners();
  return result;
}

export async function removePartner(partnerId: number): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(partnerId)) return refused("Unknown partner.");
  const result = await write("partners", (data) => data.partners.remove(partnerId));
  if (result.ok) refreshPublicPartners();
  return result;
}

/** A tier's partners in their new order, as dragged. */
export async function reorderPartners(tier: PartnerTier, partnerIds: readonly number[]): Promise<WriteResult<null>> {
  if ((tier !== "main" && tier !== "media") || !Array.isArray(partnerIds) || !partnerIds.every(Number.isSafeInteger)) {
    return refused("Unknown partners.");
  }
  const result = await write("partners", (data) => data.partners.reorder(tier, partnerIds));
  if (result.ok) refreshPublicPartners();
  return result;
}

/** The two pages that show partners render again with the new list (the cached read is refreshed by the write). */
function refreshPublicPartners(): void {
  revalidatePath("/partners");
  revalidatePath("/");
}

// The FAQ page (boards 79 and 79b, issue #258), behind the same site-content
// gate. /apply is prerendered whole (issue #163), so each write renders it
// again; the write itself refreshes the cached read of the questions.

/** Save draft or Publish on a question; `faqId` null is New question. The answer is one `answer` field per paragraph box. */
export async function saveFaq(faqId: number | null, step: PublishStep, form: FormData): Promise<WriteResult<ContentItem<FaqVersion>>> {
  if (faqId !== null && !Number.isSafeInteger(faqId)) return refused("Unknown question.");
  if (!isPublishStep(step)) return refused("Save a draft or publish.");
  const fields: FaqFields = { question: String(form.get("question") ?? ""), answer: form.getAll("answer").map(String) };
  const result = await write("faq", (data) => data.faqs.save(faqId, step, fields));
  if (result.ok) revalidatePath("/apply");
  return result;
}

export async function removeFaq(faqId: number): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(faqId)) return refused("Unknown question.");
  const result = await write("faq", (data) => data.faqs.remove(faqId));
  if (result.ok) revalidatePath("/apply");
  return result;
}

/** Every question in its new order, as dragged. */
export async function reorderFaqs(faqIds: readonly number[]): Promise<WriteResult<null>> {
  if (!Array.isArray(faqIds) || !faqIds.every(Number.isSafeInteger)) return refused("Unknown questions.");
  const result = await write("faq", (data) => data.faqs.reorder(faqIds));
  if (result.ok) revalidatePath("/apply");
  return result;
}

// The Team page's visual layer (issue #283) and advisors (board 80d, issue
// #286), behind the same site-content gate. Save draft and Reset to team
// change only the draft; Publish changes what /about/the-team shows, so it
// renders the page again. None of them writes a role, division, department,
// scope or member.

/**
 * Save draft or Publish the whole layer and the Advisors panel's rows, in
 * page order, as the editor holds them: one write, so either both land or
 * neither does (issue #321), and one render of the page on Publish.
 */
export async function saveTeamPage(step: PublishStep, layer: unknown, advisors: unknown): Promise<WriteResult<TeamPageSaved>> {
  if (!isPublishStep(step)) return refused("Save a draft or publish.");
  const result = await write("team-page", (data) => data.teamPage.save(step, layer, advisors));
  if (result.ok && step === "publish") revalidatePath("/about/the-team");
  return result;
}

/** Reset to team (board 80h): a draft with every edit gone except the intro text and the group photo. */
export async function resetTeamPageLayer(): Promise<WriteResult<Versioned<TeamPageLayer>>> {
  return write("team-page", (data) => data.teamPage.reset());
}

/**
 * A photo cropped in Replace photo on a Team page panel (issue #323), stored
 * at once so the page can show it; Save draft or Publish puts it on the
 * person or advisor. Nothing renders again: no saved page shows it yet.
 */
export async function uploadTeamPagePhoto(form: FormData): Promise<WriteResult<PersonPhoto>> {
  const photo = await uploadOf(form, "photo");
  if (photo === null) return refused("Choose a photo.");
  return write("team-page", (data) => data.teamPage.uploadPhoto(photo));
}

/** End advising: the advisor leaves the Team page and joins the Alumni page's Advisors group for `years`. */
export async function endAdvising(advisorId: number, years: unknown): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(advisorId)) return refused("Unknown advisor.");
  const result = await write("team-page", (data) => data.teamAdvisors.end(advisorId, years));
  if (result.ok) {
    revalidatePath("/about/the-team");
    revalidatePath("/about/alumni");
    revalidatePath("/dashboard/alumni");
  }
  return result;
}

// The Edit post panel (boards 74c, 74d and 74h, issue #290). The site-content
// gate inside the outreach editor (lib/outreach-editor.ts) decides who may
// write, as it decides who opens the post page. The writes refresh the cached
// published read themselves; the pages that show posts render again.

async function contentWrite<T>(run: (data: DashboardData) => Promise<WriteResult<T>>): Promise<WriteResult<T>> {
  const opening = await openDashboard();
  return opening.kind === "open" ? run(opening.data) : refused("Sign in again to make changes.");
}

function refreshPublicOutreach(): void {
  revalidatePath("/outreach", "layout");
  revalidatePath("/");
}

/** Save draft or Publish on a post, or on a new one (`postId` null, board 74f), with the panel's fields. */
export async function saveOutreachPost(postId: number | null, step: PublishStep, input: unknown): Promise<WriteResult<PostItem>> {
  if (postId !== null && !Number.isSafeInteger(postId)) return refused("Unknown post.");
  if (!isPublishStep(step)) return refused("Save a draft or publish.");
  const fields = readPostFields(input);
  if (fields === null) return refused("Reload the page and try again.");
  const result = await contentWrite((data) => data.outreach.savePost(postId, step, fields));
  if (result.ok) refreshPublicOutreach();
  return result;
}

/** A tag typed at the end of the tag list (Enter adds it); every post can pick it from then on. */
export async function addOutreachTag(name: string): Promise<WriteResult<OutreachTag>> {
  const result = await contentWrite((data) => data.outreach.addTag(String(name ?? "")));
  if (result.ok) refreshPublicOutreach();
  return result;
}

/** A photo picked in the Photos section (issue #291), stored at once so the page can show it; a save puts it on the post. */
export async function uploadOutreachPhoto(form: FormData): Promise<WriteResult<PhotoSrc>> {
  const photo = await uploadOf(form, "photo");
  if (photo === null) return refused("Choose a photo.");
  return contentWrite((data) => data.outreach.uploadPhoto(photo));
}

/** A photo removed before a save used it: its file goes, unless a post version shows it. */
export async function discardOutreachPhoto(src: string): Promise<WriteResult<null>> {
  return contentWrite((data) => data.outreach.discardPhoto(String(src ?? "")));
}

export async function saveLinkedin(text: string): Promise<WriteResult<string | null>> {
  return write("my-profile", (data) => data.saveLinkedin(String(text)));
}

export async function uploadPhoto(form: FormData): Promise<WriteResult<null>> {
  const photo = await uploadOf(form, "photo");
  if (photo === null) return refused("Choose a photo.");
  return write("my-profile", (data) => data.setPhoto(photo));
}

export async function removePhoto(): Promise<WriteResult<null>> {
  return write("my-profile", (data) => data.setPhoto(null));
}

export async function leaveTeam(reason: string, removeFromAlumni: boolean): Promise<WriteResult<DashboardLanding>> {
  const result = await write("my-profile", (data) => data.leaveTeam(String(reason ?? ""), removeFromAlumni === true));
  // Off the team, the sidebar and every page change to an alumnus's (issues #201, #317).
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

/**
 * My alumni's switch (board 56b, issue #317). The Overview's card reads it
 * again; the public Alumni page follows its cache tag (./database-alumni.ts).
 */
export async function setMyAlumniShown(shown: boolean): Promise<WriteResult<null>> {
  if (typeof shown !== "boolean") return refused("Check the switch.");
  const result = await write("my-alumni", (data) => data.setMyAlumniShown(shown));
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

/** My alumni's photo: the one the Alumni page shows beside their name. */
export async function uploadMyAlumniPhoto(form: FormData): Promise<WriteResult<null>> {
  const photo = await uploadOf(form, "photo");
  if (photo === null) return refused("Choose a photo.");
  return write("my-alumni", (data) => data.setMyAlumniPhoto(photo));
}

export async function removeMyAlumniPhoto(): Promise<WriteResult<null>> {
  return write("my-alumni", (data) => data.setMyAlumniPhoto(null));
}

/** "Send for confirmation" on My profile (board 55d, issue #262): the hand-over waits; no role changes. */
export async function sendHandOver(input: unknown): Promise<WriteResult<null>> {
  const result = await write("my-profile", (data) => data.sendHandOver(input));
  if (result.ok) revalidatePath("/dashboard/profile");
  return result;
}

/** Decline or Confirm on the Overview (board 62c): Confirm hands the role over, so every page reads again. */
export async function answerHandOver(requestId: number, answer: unknown): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(requestId)) return refused("Unknown hand-over.");
  if (!isHandOverAnswer(answer)) return refused("Choose Decline or Confirm.");
  const result = await write("overview", (data) => data.answerHandOver(requestId, answer));
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

/** Request alias in the member drawer (board 94, epic #538): the drawer reads again with the request waiting. */
export async function requestAlias(memberId: number): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(memberId)) return refused("Unknown member.");
  const result = await write("members", (data) => data.requestAlias(memberId));
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

/** Request team address in the member drawer (board 102b, epic #578): the drawer reads again; the request waits for an approver. */
export async function requestTeamAddress(input: unknown): Promise<WriteResult<null>> {
  const result = await write("members", (data) => data.requestTeamAddress(input));
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

/** Decline or Mark created on the Overview (epic #578, issue #788): the row leaves, and Mark created shows the address in the member drawer. */
export async function answerTeamAddress(requestId: number, answer: unknown): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(requestId)) return refused("Unknown team address request.");
  const result = await write("overview", (data) => data.answerTeamAddress(requestId, answer));
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

/** Cancel request in the member drawer (board 94b). */
export async function cancelAliasRequest(requestId: number): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(requestId)) return refused("Unknown alias request.");
  const result = await write("members", (data) => data.cancelAliasRequest(requestId));
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

/** Decline or Mark created on the Overview (boards 94c, 94d): the row leaves, and the member drawer shows the alias. */
export async function answerAlias(requestId: number, answer: unknown): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(requestId)) return refused("Unknown alias request.");
  const result = await write("overview", (data) => data.answerAlias(requestId, answer));
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

/**
 * "I've set it up" in the setup steps (board 94g, issue #542): stored on the
 * viewer's own record; it names no member, so it can reach nobody else's. The
 * Overview reads again without the card.
 */
export async function confirmAliasSetUp(): Promise<WriteResult<null>> {
  const result = await write(["overview", "my-profile"], (data) => data.confirmAliasSetUp());
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

export async function withdrawApplication(applicationId: number): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(applicationId)) return refused("Unknown application.");
  return write("my-applications", (data) => data.withdrawApplication(applicationId));
}

export async function chooseInterviewSlot(applicationId: number, slotId: number): Promise<WriteResult<InterviewSlot>> {
  if (!Number.isSafeInteger(applicationId) || !Number.isSafeInteger(slotId)) return refused("Unknown interview time.");
  return write("my-applications", (data) => data.chooseInterviewSlot(applicationId, slotId));
}

/** "Your details" live on My account for an applicant and on My profile for the team. */
const OWN_PAGES = ["my-account", "my-profile"] as const satisfies readonly DashboardPageKey[];

export async function saveDetails(input: unknown): Promise<WriteResult<YourDetails>> {
  return write(OWN_PAGES, (data) => data.saveDetails(input));
}

export async function deleteAccount(withdrawOpenApplications: boolean, removeFromAlumni: boolean): Promise<WriteResult<null>> {
  return write(OWN_PAGES, (data) =>
    data.deleteAccount({ withdrawOpenApplications: withdrawOpenApplications === true, removeFromAlumni: removeFromAlumni === true }),
  );
}
