import { SHARE_IMAGE_ALT, SHARE_IMAGE_SIZE, SHARE_IMAGE_TYPE, shareImage } from "@/components/share-image/share-image";
import { pageShareCard } from "@/lib/share-image";

// The Mission & Vision page's share image (board 90, Zp3hm layout, issue #454).
export const alt = SHARE_IMAGE_ALT;
export const size = SHARE_IMAGE_SIZE;
export const contentType = SHARE_IMAGE_TYPE;

export default function Image() {
  return shareImage(pageShareCard("mission-vision"));
}
