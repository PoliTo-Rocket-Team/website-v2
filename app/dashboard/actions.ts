"use server";

import { canReach, type DashboardPageKey } from "@/lib/dashboard/access";
import type { DashboardData } from "@/lib/dashboard/data";
import type { YourDetails } from "@/lib/dashboard/details";
import type { AccessGrant } from "@/lib/dashboard/division-access";
import type { InterviewSlot } from "@/lib/dashboard/my-applications";
import { openDashboard } from "@/lib/dashboard/open";
import type { Order } from "@/lib/dashboard/orders";
import { refused, type Upload, type WriteResult } from "@/lib/dashboard/write";

// The dashboard's writes (issues #145 and #169). Each one opens the dashboard as the
// page did, checks the viewer reaches the page the write belongs to, and
// hands what the browser sent to the data interface, which checks it again
// and writes: to nothing for a test developer, to the database otherwise.

/** The dashboard, when the viewer reaches one of `pages`; else why not. */
async function dataFor(pages: DashboardPageKey | readonly DashboardPageKey[]): Promise<DashboardData | string> {
  const opening = await openDashboard();
  if (opening.kind !== "open") return "Sign in again to make changes.";
  const kind = opening.data.viewer.kind;
  if (!(typeof pages === "string" ? [pages] : pages).some((page) => canReach(kind, page))) return "You do not have this page.";
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

/** Give access or Edit access (boards 60b and 60c). */
export async function saveAccess(input: unknown): Promise<WriteResult<readonly AccessGrant[]>> {
  return write("division-access", (data) => data.saveAccess(input));
}

export async function removeAllAccess(personId: number): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(personId)) return refused("Unknown person.");
  return write("division-access", (data) => data.removeAllAccess(personId));
}

const ORDER_FIELDS = ["item", "link", "price", "quantity", "reason"] as const;

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

export async function leaveTeam(reason: string): Promise<WriteResult<null>> {
  return write("my-profile", (data) => data.leaveTeam(String(reason ?? "")));
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

export async function deleteAccount(withdrawOpenApplications: boolean): Promise<WriteResult<null>> {
  return write(OWN_PAGES, (data) => data.deleteAccount({ withdrawOpenApplications: withdrawOpenApplications === true }));
}
