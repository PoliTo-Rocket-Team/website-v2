"use server";

import { revalidatePath } from "next/cache";
import { canReach, type DashboardLanding, type DashboardPageKey } from "@/lib/dashboard/access";
import type { DashboardData } from "@/lib/dashboard/data";
import type { YourDetails } from "@/lib/dashboard/details";
import type { AccessGrant } from "@/lib/dashboard/division-access";
import { isHandOverAnswer } from "@/lib/dashboard/hand-over-request";
import type { InterviewSlot } from "@/lib/dashboard/my-applications";
import { openDashboard } from "@/lib/dashboard/open";
import type { Order } from "@/lib/dashboard/orders";
import { refused, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { isPublishStep, type ContentItem, type PublishStep } from "@/lib/content/versioned";
import type { Partner, PartnerTier } from "@/lib/partners";
import type { MeasuredLogo } from "@/lib/partners-editor";
import { PARTNER_FIELDS, type PartnerFields } from "@/lib/partners-fields";
import type { FaqFields, FaqVersion } from "@/lib/faq/faq";

// The dashboard's writes (issues #145 and #169). Each one opens the dashboard as the
// page did, checks the viewer reaches the page the write belongs to, and
// hands what the browser sent to the data interface, which checks it again
// and writes: to nothing for a test developer, to the database otherwise.

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

/** The file field of a form as an Upload; null when no file was sent. */
async function uploadOf(form: FormData, field: string): Promise<Upload | null> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  return { name: file.name, contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
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

/** The panel measures a picked logo, so it can say whether the site draws it white before it is saved. */
export async function measurePartnerLogo(form: FormData): Promise<WriteResult<MeasuredLogo>> {
  const logo = await uploadOf(form, "logo");
  if (logo === null) return refused("Choose a logo.");
  return write("partners", (data) => data.partners.measure(logo));
}

/** Save draft or Publish on a partner; `partnerId` null is New partner. */
export async function savePartner(partnerId: number | null, step: PublishStep, form: FormData): Promise<WriteResult<ContentItem<Partner>>> {
  if (partnerId !== null && !Number.isSafeInteger(partnerId)) return refused("Unknown partner.");
  if (!isPublishStep(step)) return refused("Save a draft or publish.");
  const fields = textFields(form, PARTNER_FIELDS) as PartnerFields;
  const result = await write("partners", async (data) => data.partners.save(partnerId, step, fields, await uploadOf(form, "logo")));
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
  // Off the team, the sidebar and every page change to the applicant's (issue #201).
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
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
