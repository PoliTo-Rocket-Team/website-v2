import { SHARE_IMAGE_ALT, SHARE_IMAGE_SIZE, SHARE_IMAGE_TYPE, shareImage } from "@/components/share-image/share-image";
import { defaultShareCard } from "@/lib/share-image";

// The default share image (board 90, K2zr8Y, issue #454): home, and every
// public page without its own. The dashboard and the sign-in page drop it
// (their `openGraph: null`).

export const alt = SHARE_IMAGE_ALT;
export const size = SHARE_IMAGE_SIZE;
export const contentType = SHARE_IMAGE_TYPE;

export default function Image() {
  return shareImage(defaultShareCard);
}
