import { isPdfBytes } from "@/lib/apply/application-form";
import { photoTypeOf } from "@/lib/outreach-photos";
import { MAX_MEMBER_PHOTO_BYTES } from "./division-members";
import { MAX_QUOTE_BYTES } from "./orders";
import { MAX_PHOTO_BYTES } from "./self";
import { refused, written, type Upload, type WriteResult } from "./write";

// The server's checks of a dashboard upload (issue #831): what a file is, it
// reads from the file's own first bytes (`photoTypeOf`, `isPdfBytes`), never
// from the type or name the browser declared, and the store is told that
// type. The browser's own checks (`checkPhoto`, `checkMemberPhoto`,
// `checkQuote`) still read the declared type, to answer before it sends.

/** A photo the public store may take: its bytes and the type and extension they show. */
export type CheckedImage = {
  readonly bytes: Uint8Array;
  readonly contentType: "image/jpeg" | "image/png";
  readonly extension: "jpg" | "png";
};

const JPEG = { contentType: "image/jpeg", extension: "jpg" } as const;
const PNG = { contentType: "image/png", extension: "png" } as const;

/** A My profile or Alumni photo (board 45): a JPEG or PNG by its bytes, of at most 2 MB. */
export function checkedPhoto(upload: Upload): WriteResult<CheckedImage> {
  const type = photoTypeOf(upload.bytes);
  const kind = type === "image/jpeg" ? JPEG : type === "image/png" ? PNG : null;
  if (kind === null) return refused("The photo must be a JPEG or PNG.");
  if (upload.bytes.byteLength > MAX_PHOTO_BYTES) return refused("The photo must be 2 MB or less.");
  return written({ bytes: upload.bytes, ...kind });
}

/** A member photo from Edit details (board 61g): a JPEG by its bytes, under 500 KB. */
export function checkedMemberPhoto(upload: Upload): WriteResult<CheckedImage> {
  if (photoTypeOf(upload.bytes) !== "image/jpeg") return refused("The photo must be a JPEG.");
  if (upload.bytes.byteLength > MAX_MEMBER_PHOTO_BYTES) return refused("The photo must be under 500 KB.");
  return written({ bytes: upload.bytes, ...JPEG });
}

/** An order's quote: a PDF by its bytes, of at most 10 MB. */
export function checkedQuote(upload: Upload): WriteResult<Uint8Array> {
  if (!isPdfBytes(upload.bytes)) return refused("The quote must be a PDF.");
  if (upload.bytes.byteLength > MAX_QUOTE_BYTES) return refused("The quote must be 10 MB or less.");
  return written(upload.bytes);
}
