import { textLength } from "@/lib/content/text";
import { publicItems, type ContentItem } from "@/lib/content/versioned";
import { dayMonth } from "@/lib/dashboard/application-flow";
import { refused, written, type WriteResult } from "@/lib/dashboard/write";
import type { Faq, FaqAnswer } from "@/lib/apply/page";

// The questions at the bottom of /apply as the dashboard edits them (boards
// 79 and 79b, issue #258). Each one is a content item (lib/content/): a
// published version /apply shows and an optional draft beside it, in site
// order. A version also says when it was written, which the list shows as
// Updated.

/** The longest question the panel takes (board 79b: "35 / 120"). */
export const FAQ_QUESTION_MAX = 120;

/** The longest paragraph the server takes: a bound on the input, far over any answer's paragraph. */
export const FAQ_PARAGRAPH_MAX = 1500;

/** One version of a question: what /apply shows, and when it was written (an ISO time). */
export type FaqVersion = Faq & { readonly updatedAt: string };

/** The panel's fields: the question, and one string per answer box, blank boxes included. */
export type FaqFields = { readonly question: string; readonly answer: readonly string[] };

export type FaqFieldErrors = { readonly question?: string; readonly answer?: string };

/** The fields a question fills the panel with; a new question opens on one empty paragraph. */
export function fieldsOf(faq: Faq | null): FaqFields {
  return faq === null ? { question: "", answer: [""] } : { question: faq.question, answer: [...faq.answer] };
}

/** The answer's paragraphs as /apply shows them: trimmed, with blank boxes dropped. */
function paragraphsOf(answer: readonly string[]): string[] {
  return answer.map((p) => p.trim()).filter((p) => p !== "");
}

/** Every field that is wrong, by name; empty when the fields make a question. */
export function faqFieldErrors(fields: FaqFields): FaqFieldErrors {
  const question = fields.question.trim();
  const paragraphs = paragraphsOf(fields.answer);
  const long = paragraphs.find((p) => textLength(p) > FAQ_PARAGRAPH_MAX);
  return {
    ...(question === ""
      ? { question: "Write the question." }
      : textLength(question) > FAQ_QUESTION_MAX && { question: `${textLength(question)} characters; the limit is ${FAQ_QUESTION_MAX}.` }),
    ...(paragraphs.length === 0
      ? { answer: "Write at least one paragraph." }
      : long !== undefined && { answer: `A paragraph is ${textLength(long)} characters; the limit is ${FAQ_PARAGRAPH_MAX}.` }),
  };
}

/** The fields as a question and its answer, or the first error. The server runs this on whatever it is sent. */
export function checkFaqFields(fields: FaqFields): WriteResult<Faq> {
  const errors = faqFieldErrors(fields);
  const first = errors.question ?? errors.answer;
  if (first !== undefined) return refused(first);
  const [lead, ...rest] = paragraphsOf(fields.answer);
  const answer: FaqAnswer = [lead, ...rest];
  return written({ question: fields.question.trim(), answer });
}

/** The questions /apply shows: the published ones, in site order, without when they were written. */
export function publicFaqs(items: readonly ContentItem<FaqVersion>[]): Faq[] {
  return publicItems(items).map(({ question, answer }) => ({ question, answer }));
}

/** An answer read back from storage: null when it holds no paragraph, which no write leaves behind. */
export function answerOf(paragraphs: readonly string[]): FaqAnswer | null {
  const [lead, ...rest] = paragraphs;
  return lead === undefined ? null : [lead, ...rest];
}

/**
 * Where a published question sits on /apply ("3 of 11 on the Apply page",
 * board 79b): its place among the published questions, in site order; null
 * for a question /apply does not show.
 */
export function placeOnApplyPage(items: readonly ContentItem<FaqVersion>[], id: number): { place: number; of: number } | null {
  const shown = [...items].filter((item) => item.version.state === "published").sort((a, b) => a.siteOrder - b.siteOrder);
  const index = shown.findIndex((item) => item.id === id);
  return index === -1 ? null : { place: index + 1, of: shown.length };
}

/** The list's Updated column (board 79): "Today", else the day, "12 Sep", in Turin. */
export function updatedLabel(at: string, now: string): string {
  return dayMonth(at) === dayMonth(now) && Math.abs(Date.parse(now) - Date.parse(at)) < DAY ? "Today" : dayMonth(at);
}

const DAY = 24 * 60 * 60 * 1000;
