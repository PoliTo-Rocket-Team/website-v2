import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { publicStoreTeamPagePhotos } from "@/lib/about/team-page-photos";
import type { PersonPhoto } from "@/lib/about/types";
import { checkMemberPhoto } from "@/lib/dashboard/division-members";
import { centredCrop, sourceSquare } from "@/lib/dashboard/photo-crop";
import { checkPhotoUpload, type CheckedPhoto, type PublicFileWrites } from "@/lib/outreach-photos";
import { publicPathname, publicPathnameOfUrl, publicStoreHost, type PublicStoreHost } from "@/lib/storage/pathname";
import type { At } from "./conflicts";
import { nameKey } from "./people";
import type { Sources } from "./sources";
import { seatsOf } from "./titles";
import { unitValues } from "./units";

// Member and advisor photos (issues #677, #816), from the `photos/` folder the
// old Supabase Storage exported. A file named `<id>-<surname>.jpeg` is a
// member's: the id is a row's `id` in `people_rows.csv`, matched exactly, and
// never an advisor's id (owner decision, #816); the surname only cross-checks
// it. A file named `<surname>.jpeg` is an advisor's or a professor's: it
// matches the one advisor with that surname, in `advisors_rows.csv` or among
// the workbook's advisor rows; none, or more than one, is reported.
//
// A member photo is shaped as the dashboard's crop dialog makes one
// (components/dashboard/photo-crop-dialog.tsx): the default centred square
// (`centredCrop`, `sourceSquare`), at most 800 px a side, a JPEG at quality
// 0.9; it must then pass Edit details' `checkMemberPhoto`, and it is stored
// under `publicPathname("photo", "<memberId>-<uuid>.jpg")`, as My profile and
// Edit details store one. An advisor photo is stored as the Team page editor
// stores one: `checkPhotoUpload`, then `publicStoreTeamPagePhotos(...).put`.
// A photo file is named in the report by its row only: its place in the
// sorted file list, never its name, which holds a surname.

/** The folder of the source directory the photos are read from. */
export const PHOTO_FOLDER = "photos/";

/** The longest side of a member photo, as the crop dialog's `PHOTO_SIZE`. */
export const MEMBER_PHOTO_SIZE = 800;
/** The JPEG quality of a member photo: the crop dialog's 0.9. */
export const MEMBER_PHOTO_QUALITY = 90;

/** One file of the folder: its row (its place in the sorted file list, from 1), and the id and surname its name gives. */
export type PhotoFile = { readonly row: number; readonly id: string | null; readonly surname: string; readonly bytes: Buffer };

/** The folder's files, sorted by name; null when the folder is not there. */
export function readPhotoFolder(directory: string): PhotoFile[] | null {
  const folder = join(directory, PHOTO_FOLDER);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) return null;
  const names = readdirSync(folder)
    .filter((n) => !n.startsWith(".") && statSync(join(folder, n)).isFile())
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return names.map((name, i) => {
    const m = /^(?:(\d+)-)?(.*?)(\.[^.]*)?$/.exec(name)!;
    return { row: i + 1, id: m[1] ?? null, surname: m[2], bytes: readFileSync(join(folder, name)) };
  });
}

/** Where a photo file is, for a conflict. */
export const photoAt = (file: Pick<PhotoFile, "row">): At => ({ file: PHOTO_FOLDER, row: file.row });

/** How a surname is compared: accents, case, spaces and punctuation do not count. */
export function surnameKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Why a file matched nothing. */
export type PhotoMiss = "surname-differs" | "no-id-match" | "no-surname-match" | "surname-ambiguous";

/**
 * What a file's name matches (owner decision, issue #816). `<id>-<surname>`:
 * the `people_rows.csv` row with that id, never an advisor's. A surname only:
 * the one advisor with that surname, either an `advisors_rows.csv` row (by its
 * line) or a person whose workbook row is an advisor's (by that row).
 */
export type PhotoMatch =
  | { readonly kind: "member"; readonly file: PhotoFile; readonly id: string }
  | { readonly kind: "advisor"; readonly file: PhotoFile; readonly line: number }
  | { readonly kind: "workbook-advisor"; readonly file: PhotoFile; readonly at: At }
  | { readonly kind: PhotoMiss; readonly file: PhotoFile };

/** Whether a workbook row is an advisor's: an advisor marker in its unit cells, or an advisor seat in its title. */
function isAdvisorRow(value: Readonly<Record<"subteam" | "division" | "title", string>>): boolean {
  const marked = [value.subteam, value.division].some((cell) => unitValues(cell, new Set()).some((v) => v.kind === "advisor"));
  return marked || seatsOf(value.title).some((s) => s.kind === "seat" && s.seat.type === "advisor");
}

/** Matches each file: an id against `people_rows.csv` (the surname cross-checks it), a surname only against the advisors. */
export function matchPhotos(files: readonly PhotoFile[], sources: Sources): PhotoMatch[] {
  const people = new Map<string, string>();
  for (const r of sources.csv.people) if (r.value.id.trim() !== "" && !people.has(r.value.id.trim())) people.set(r.value.id.trim(), r.value.lastName);

  // The advisors, by surname, then by full name: one name is one advisor, wherever it is listed; the CSV row wins.
  type Advisor = { readonly line: number } | { readonly at: At };
  const advisors = new Map<string, Map<string, Advisor>>();
  const addAdvisor = (first: string, last: string, advisor: Advisor) => {
    const bySurname = advisors.get(surnameKey(last)) ?? new Map<string, Advisor>();
    const name = nameKey(first, last);
    if (!bySurname.has(name)) bySurname.set(name, advisor);
    advisors.set(surnameKey(last), bySurname);
  };
  for (const r of sources.csv.advisors) if (surnameKey(r.value.lastName) !== "") addAdvisor(r.value.firstName, r.value.lastName, { line: r.at.row });
  for (const row of [...sources.years.flatMap((s) => s.rows), ...sources.quitters]) {
    if (surnameKey(row.value.lastName) !== "" && isAdvisorRow(row.value)) addAdvisor(row.value.firstName, row.value.lastName, { at: row.at });
  }

  return files.map((file): PhotoMatch => {
    if (file.id !== null) {
      const surname = people.get(file.id);
      if (surname === undefined) return { kind: "no-id-match", file };
      return surnameKey(surname) !== "" && surnameKey(surname) === surnameKey(file.surname) ? { kind: "member", file, id: file.id } : { kind: "surname-differs", file };
    }
    const found = [...(advisors.get(surnameKey(file.surname))?.values() ?? [])];
    if (found.length === 0 || surnameKey(file.surname) === "") return { kind: "no-surname-match", file };
    if (found.length > 1) return { kind: "surname-ambiguous", file };
    const one = found[0];
    return "line" in one ? { kind: "advisor", file, line: one.line } : { kind: "workbook-advisor", file, at: one.at };
  });
}

/** A member photo shaped as the crop dialog makes one, and passing `checkMemberPhoto`. */
export type MemberPhoto = { readonly bytes: Uint8Array; readonly contentType: "image/jpeg" };

/** The member photo a file makes, or null when it cannot be read or still fails `checkMemberPhoto` once shaped. */
export async function shapeMemberPhoto(bytes: Uint8Array): Promise<MemberPhoto | null> {
  try {
    const upright = await sharp(bytes).rotate().toBuffer({ resolveWithObject: true });
    const { width, height } = upright.info;
    const { sx, sy, side } = sourceSquare(centredCrop(width, height, Math.min(width, height)));
    const square = { left: Math.round(sx), top: Math.round(sy), width: Math.round(side), height: Math.round(side) };
    const out = Math.round(Math.min(square.width, MEMBER_PHOTO_SIZE));
    const shaped = await sharp(upright.data).extract(square).resize(out, out).jpeg({ quality: MEMBER_PHOTO_QUALITY }).toBuffer();
    return checkMemberPhoto({ type: "image/jpeg", size: shaped.byteLength }) === null ? { bytes: new Uint8Array(shaped), contentType: "image/jpeg" } : null;
  } catch {
    return null;
  }
}

/** An advisor photo the Team page editor would take, or null when `checkPhotoUpload` refuses it. */
export function checkAdvisorPhoto(bytes: Uint8Array): CheckedPhoto | null {
  const checked = checkPhotoUpload({ name: "photo", contentType: "", bytes });
  return checked.ok ? checked.value : null;
}

/** A matched file, ready: shaped (a member's) or checked (an advisor's); null when it is unfit. */
export type PreparedPhoto =
  | { readonly kind: "member"; readonly row: number; readonly id: string; readonly photo: MemberPhoto | null }
  | { readonly kind: "workbook-advisor"; readonly row: number; readonly at: At; readonly photo: MemberPhoto | null }
  | { readonly kind: "advisor"; readonly row: number; readonly line: number; readonly photo: CheckedPhoto | null }
  | { readonly kind: PhotoMiss; readonly row: number };

/** The `photos/` folder as the plan reads it. */
export type PhotoFolder = {
  /** How many files it holds. */
  readonly files: number;
  readonly photos: readonly PreparedPhoto[];
  /** The id parts its file names give: a `people_rows.csv` `has_pp` row whose id is not here has no file. */
  readonly ids: ReadonlySet<string>;
  /** The `advisors_rows.csv` lines a file matched: a `has_pp` advisor row not here has no file. */
  readonly advisorLines: ReadonlySet<number>;
};

/** Reads, matches and shapes the folder's photos; null when the source directory has no `photos/` folder. Nothing is uploaded. */
export async function preparePhotos(directory: string, sources: Sources): Promise<PhotoFolder | null> {
  const files = readPhotoFolder(directory);
  if (files === null) return null;
  const matches = matchPhotos(files, sources);
  const photos = await Promise.all(
    matches.map(async (m): Promise<PreparedPhoto> => {
      if (m.kind === "member") return { kind: "member", row: m.file.row, id: m.id, photo: await shapeMemberPhoto(m.file.bytes) };
      if (m.kind === "workbook-advisor") return { kind: "workbook-advisor", row: m.file.row, at: m.at, photo: await shapeMemberPhoto(m.file.bytes) };
      if (m.kind === "advisor") return { kind: "advisor", row: m.file.row, line: m.line, photo: checkAdvisorPhoto(m.file.bytes) };
      return { kind: m.kind, row: m.file.row };
    }),
  );
  return {
    files: files.length,
    photos,
    ids: new Set(files.flatMap((f) => (f.id === null ? [] : [f.id]))),
    advisorLines: new Set(matches.flatMap((m) => (m.kind === "advisor" ? [m.line] : []))),
  };
}

/** The public store photos go to: the host it serves files from, and its writes. */
export type PhotoStore = { readonly host: PublicStoreHost; readonly writes: PublicFileWrites };

/** Where photos are uploaded during an import. */
export type PhotoUploads = {
  /** Stores a member's photo and answers its URL, for `members.picture`. */
  member(memberId: number, photo: MemberPhoto): Promise<string>;
  /** Stores an advisor's photo and answers its URL, for the advisor version's `photo`. */
  advisor(photo: CheckedPhoto): Promise<PersonPhoto>;
};

export function photoUploads({ host, writes }: PhotoStore): PhotoUploads {
  const teamPage = publicStoreTeamPagePhotos(host, writes, randomUUID);
  return {
    async member(memberId, photo) {
      const pathname = publicPathname("photo", `${memberId}-${randomUUID()}.jpg`);
      const { url } = await writes.upload(pathname, photo.bytes, photo.contentType);
      if (publicPathnameOfUrl(url, host) !== pathname) throw new Error("The public store answered a URL off its own host or pathname.");
      return url;
    },
    advisor: (photo) => teamPage.put(photo),
  };
}

/**
 * The public store a Vercel Blob read-write token opens. Its store id is the
 * token's fourth `_` part (`vercel_blob_rw_<storeId>_<secret>`), as the Blob
 * SDK reads it. Each upload passes the token, `access: "public"` and the
 * content type, as `uploadPublicFile` does with the deployment's credential.
 */
export async function blobPhotoStore(token: string): Promise<PhotoStore> {
  const storeId = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(token)?.[1];
  if (storeId === undefined) throw new Error("The storage token is not a Vercel Blob read-write token.");
  const { put, del } = await import("@vercel/blob");
  return {
    host: publicStoreHost(storeId),
    writes: {
      async upload(pathname, bytes, contentType) {
        const { url } = await put(pathname, Buffer.from(bytes), { access: "public", token, contentType });
        return { url };
      },
      async remove(pathname) {
        await del(pathname, { token });
      },
    },
  };
}
