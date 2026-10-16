import type { ContentStore } from "@/lib/content/editor";
import type { ContentItem } from "@/lib/content/versioned";
import { checkFaqFields, fieldsOf, type FaqVersion } from "@/lib/faq/faq";
import { importedFaqs } from "@/lib/faq/import";
import { dummyContentStore, parseContentEdits, serializeContentEdits, type ContentEdits, type ContentEditsStore } from "./content-edits";
import { DUMMY_NOW } from "./team";

// The questions on previews and in test-developer sessions (issue #258),
// which never touch a database. The dashboard starts from the questions the
// import carries into the database, published on 12 Sep, with the third one
// holding draft changes written today, as board 79 draws it. A test
// developer's changes are kept in their own cookie (./content-edits.ts); /apply
// never reads it.

/** When the dummy questions were published (board 79: "12 Sep"). */
const PUBLISHED_AT = "2026-09-12T10:00:00.000Z";

/** The question the dummy dashboard shows with draft changes ("Can I join as a first-year student?" on board 79). */
const DRAFTED_ID = 3;

/** The dashboard's starting questions: the import, with the third one's second paragraph changed in a draft (board 79b). */
export function dummyFaqSeed(): ContentItem<FaqVersion>[] {
  return importedFaqs(PUBLISHED_AT).map((item) => {
    if (item.id !== DRAFTED_ID || item.version.state !== "published") return item;
    const published = item.version.published;
    const draft: FaqVersion = {
      question: published.question,
      answer: [published.answer[0], "More than half of the Team's members are Bachelor's students, and many of them are in their first year."],
      updatedAt: new Date(DUMMY_NOW).toISOString(),
    };
    return { ...item, version: { state: "published", published, draft } };
  });
}

export type DummyFaqEdits = ContentEdits<FaqVersion>;
export type DummyFaqEditsStore = ContentEditsStore<FaqVersion>;

/** A version the panel could have saved; anything else in the cookie is dropped. */
function isFaqVersion(value: unknown): value is FaqVersion {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<FaqVersion>;
  return (
    typeof v.question === "string" &&
    Array.isArray(v.answer) &&
    v.answer.every((p) => typeof p === "string" && p.trim() !== "") &&
    typeof v.updatedAt === "string" &&
    !Number.isNaN(Date.parse(v.updatedAt)) &&
    checkFaqFields(fieldsOf({ question: v.question, answer: v.answer as FaqVersion["answer"] })).ok
  );
}

/** The edits in the cookie; none when it is absent or not one this code wrote. */
export function parseFaqEdits(value: string | undefined): DummyFaqEdits {
  return parseContentEdits(value, isFaqVersion);
}

export const serializeFaqEdits = serializeContentEdits<FaqVersion>;

/** The test developer's questions: the seed with their edits, kept in their cookie. */
export function dummyFaqStore(edits: DummyFaqEditsStore): ContentStore<FaqVersion> {
  return dummyContentStore(dummyFaqSeed(), edits);
}

/** The dummy side's clock: the moment its team is seen from, so a question saved there reads "Today". */
export const dummyFaqNow = () => new Date(DUMMY_NOW);
