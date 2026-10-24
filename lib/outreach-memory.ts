import { memoryContentStore } from "@/lib/content/memory";
import { written } from "@/lib/dashboard/write";
import type { OutreachStore, StoredOutreach } from "./outreach-editor";
import { featuredAmong, featuring, isFeatured, unfeaturing, type FeaturedIds } from "./outreach-featured";
import { importedOutreach } from "./outreach-import";
import type { PhotoFiles } from "./outreach-photos";
import type { OutreachTag, PostItem } from "./outreach-types";

// The Outreach store held in memory, for tests of the editor's rules (issue
// #613): the posts in a memory content store (lib/content/memory.ts), the tag
// list and the featured posts. As the database's rows do
// (lib/dashboard/database-outreach.ts), a post taken off the site gives up its
// featured slot in the same write, and a third featured post is refused.

/** An Outreach store over `seed`, by default what the import migration carries into the database. */
export function memoryOutreachStore(seed: StoredOutreach = importedOutreach()): OutreachStore {
  let tags: readonly OutreachTag[] = seed.tags;
  let featured: FeaturedIds = seed.featured;
  const posts = memoryContentStore(seed.posts, async (items: readonly PostItem[]) => {
    featured = featuredAmong(featured, items);
    return null;
  });
  return {
    posts,
    tags: async () => tags,
    async addTag(name) {
      const tag = { name, award: false };
      tags = [...tags, tag];
      return written(tag);
    },
    featured: async () => featured,
    async feature(id) {
      if (isFeatured(featured, id)) return written(null);
      const next = featuring(featured, id);
      if (!next.ok) return next;
      featured = next.value;
      return written(null);
    },
    async unfeature(id) {
      featured = unfeaturing(featured, id);
      return written(null);
    },
  };
}

/** Photo files kept nowhere: an upload comes back as a data URL, which a save may carry. */
export const memoryPhotoFiles: PhotoFiles = {
  put: async (photo) => `data:${photo.contentType};base64,${Buffer.from(photo.bytes).toString("base64")}`,
  owns: (src): src is `data:image/${string}` => src.startsWith("data:image/"),
  drop: async () => {},
};
