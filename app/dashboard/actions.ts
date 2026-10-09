"use server";

import { canReach, type DashboardPageKey } from "@/lib/dashboard/access";
import type { DashboardData } from "@/lib/dashboard/data";
import type { AccessGrant } from "@/lib/dashboard/division-access";
import { openDashboard } from "@/lib/dashboard/open";
import type { Order } from "@/lib/dashboard/orders";
import { refused, type Upload, type WriteResult } from "@/lib/dashboard/write";

// The dashboard's writes (issue #145). Each one opens the dashboard as the
// page did, checks the viewer reaches the page the write belongs to, and
// hands what the browser sent to the data interface, which checks it again
// and writes: to nothing for a test developer, to the database otherwise.

async function dataFor(page: DashboardPageKey): Promise<DashboardData | string> {
  const opening = await openDashboard();
  if (opening.kind !== "open") return "Sign in again to make changes.";
  if (!canReach(opening.data.viewer.kind, page)) return "You do not have this page.";
  return opening.data;
}

async function write<T>(page: DashboardPageKey, run: (data: DashboardData) => Promise<WriteResult<T>>): Promise<WriteResult<T>> {
  const data = await dataFor(page);
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

export async function giveAccess(input: unknown): Promise<WriteResult<readonly AccessGrant[]>> {
  return write("division-access", (data) => data.giveAccess(input));
}

export async function removeAccess(grantId: number): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(grantId)) return refused("Unknown access.");
  return write("division-access", (data) => data.removeAccess(grantId));
}

export async function placeOrder(form: FormData): Promise<WriteResult<Order>> {
  const fields = textFields(form, ["item", "link", "price", "quantity", "reason"]);
  return write("orders", async (data) => data.placeOrder(fields, await uploadOf(form, "quote")));
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

export async function requestLeave(): Promise<WriteResult<null>> {
  return write("my-profile", (data) => data.requestLeave());
}

export async function withdrawApplication(applicationId: number): Promise<WriteResult<null>> {
  if (!Number.isSafeInteger(applicationId)) return refused("Unknown application.");
  return write("my-account", (data) => data.withdrawApplication(applicationId));
}

export async function deleteAccount(withdrawOpenApplications: boolean): Promise<WriteResult<null>> {
  return write("my-account", (data) => data.deleteAccount({ withdrawOpenApplications: withdrawOpenApplications === true }));
}
