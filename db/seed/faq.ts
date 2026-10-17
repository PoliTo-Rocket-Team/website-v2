// The FAQ seed (issue #305): the questions at the bottom of /apply and in the
// dashboard's FAQ editor (issue #258, boards 79 and 79b). It starts from the
// questions the import migration carries in (lib/faq/import.ts), each
// published, and the third holds a draft change to its second paragraph, as
// board 79b draws it; /apply keeps showing the published answer.

import { faqs, faqVersions } from "@/db/schema";
import type { ContentItem } from "@/lib/content/versioned";
import type { FaqVersion } from "@/lib/faq/faq";
import { importedFaqs } from "@/lib/faq/import";
import { contentVersionRows } from "./content";
import { rowsOf, tableSeedModule } from "./rows";

const CREATED = "2026-09-12 10:00:00+00";
const PUBLISHED = "2026-09-12T10:00:00.000Z";
const DRAFTED = "2026-10-09T14:00:00.000Z";

/** "Can I join as a first-year student?": published, with a draft change (board 79b). */
export const DRAFT_CHANGE_FAQ = 3;

export const FAQ_ITEMS: readonly ContentItem<FaqVersion>[] = importedFaqs(PUBLISHED).map((item): ContentItem<FaqVersion> => {
  if (item.id !== DRAFT_CHANGE_FAQ || item.version.state !== "published") return item;
  const published = item.version.published;
  const draft: FaqVersion = {
    question: published.question,
    answer: [published.answer[0], "More than half of the Team's members are Bachelor's students, and many of them are in their first year."],
    updatedAt: DRAFTED,
  };
  return { ...item, version: { state: "published", published, draft } };
});

export const FAQ_ROWS = rowsOf(
  faqs,
  FAQ_ITEMS.map(({ id, siteOrder }) => ({ id, siteOrder, createdAt: CREATED })),
);

export const FAQ_VERSION_ROWS = rowsOf(
  faqVersions,
  contentVersionRows(FAQ_ITEMS).map(({ itemId, kind, content }) => ({
    faqId: itemId,
    version: kind,
    question: content.question,
    answer: [...content.answer],
    updatedAt: content.updatedAt,
  })),
);

export const faqSeed = tableSeedModule({
  name: "faq",
  owns: [faqs, faqVersions],
  rows: [FAQ_ROWS, FAQ_VERSION_ROWS],
});
