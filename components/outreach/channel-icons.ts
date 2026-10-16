import { Facebook, Globe, Instagram, Linkedin, Music2, Twitter, Youtube, type LucideIcon } from "lucide-react";
import type { ChannelName } from "@/lib/outreach-types";

/** Each channel's icon, as the post's cards and the Edit post panel draw it (boards 33 and 74h). */
export const CHANNEL_ICONS: Readonly<Record<ChannelName, LucideIcon>> = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
  x: Twitter,
  tiktok: Music2,
  other: Globe,
};
