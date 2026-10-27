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
import type { Sources } from "./sources";

// Member and advisor photos (issue #677), from the `photos/` folder the old
// Supabase Storage exported. A file is named `<id>-<surname>.jpeg`, where the
// id is a row's `id` in `people_rows.csv` or `advisors_rows.csv` (the two
// number their rows on their own, so one id can name both). The id is matched
// first, exactly; the surname is only a cross-check, never a match by itself.
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

/** What a file's name matches: a `people_rows.csv` row or an `advisors_rows.csv` row (by its id), or why none. */
export type PhotoMatch =
  | { readonly kind: "member"; readonly file: PhotoFile; readonly id: string }
  | { readonly kind: "advisor"; readonly file: PhotoFile; readonly id: string }
  | { readonly kind: "surname-differs"; readonly file: PhotoFile }
  | { readonly kind: "no-id-match"; readonly file: PhotoFile }
  | { readonly kind: "shared-id"; readonly file: PhotoFile };

/** Matches each file on its id, then cross-checks the surname. */
export function matchPhotos(files: readonly PhotoFile[], sources: Sources): PhotoMatch[] {
  type Candidate = { kind: "member" | "advisor"; id: string; surname: string };
  const candidates = new Map<string, Candidate[]>();
  const add = (c: Candidate) => candidates.set(c.id, [...(candidates.get(c.id) ?? []), c]);
  for (const r of sources.csv.people) if (r.value.id.trim() !== "") add({ kind: "member", id: r.value.id.trim(), surname: r.value.lastName });
  for (const r of sources.csv.advisors) if (r.value.id.trim() !== "") add({ kind: "advisor", id: r.value.id.trim(), surname: r.value.lastName });
  return files.map((file): PhotoMatch => {
    const found = file.id === null ? [] : (candidates.get(file.id) ?? []);
    if (found.length === 0) return { kind: "no-id-match", file };
    const hits = found.filter((c) => surnameKey(c.surname) !== "" && surnameKey(c.surname) === surnameKey(file.surname));
    if (hits.length === 1) return { kind: hits[0].kind, file, id: hits[0].id };
    return found.length === 1 ? { kind: "surname-differs", file } : { kind: "shared-id", file };
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
  | { readonly kind: "advisor"; readonly row: number; readonly id: string; readonly photo: CheckedPhoto | null }
  | { readonly kind: "surname-differs" | "no-id-match" | "shared-id"; readonly row: number };

/** The `photos/` folder as the plan reads it. */
export type PhotoFolder = {
  /** How many files it holds. */
  readonly files: number;
  readonly photos: readonly PreparedPhoto[];
  /** The id parts its file names give: a `has_pp` row whose id is not here has no file. */
  readonly ids: ReadonlySet<string>;
};

/** Reads, matches and shapes the folder's photos; null when the source directory has no `photos/` folder. Nothing is uploaded. */
export async function preparePhotos(directory: string, sources: Sources): Promise<PhotoFolder | null> {
  const files = readPhotoFolder(directory);
  if (files === null) return null;
  const photos = await Promise.all(
    matchPhotos(files, sources).map(async (m): Promise<PreparedPhoto> => {
      if (m.kind === "member") return { kind: "member", row: m.file.row, id: m.id, photo: await shapeMemberPhoto(m.file.bytes) };
      if (m.kind === "advisor") return { kind: "advisor", row: m.file.row, id: m.id, photo: checkAdvisorPhoto(m.file.bytes) };
      return { kind: m.kind, row: m.file.row };
    }),
  );
  return { files: files.length, photos, ids: new Set(files.flatMap((f) => (f.id === null ? [] : [f.id]))) };
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
