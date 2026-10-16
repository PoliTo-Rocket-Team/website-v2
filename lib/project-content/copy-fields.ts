import type { Title } from "@/lib/project-pages/types";
import type { Copy } from "@/lib/projects";

// Text the Edit <project> panel types, and the record's text shapes it turns
// into (issues #298 and #299): a text with a shorter phone version, and a
// title with forced line breaks.

/** A text and its phone version; an empty phone field means the phone shows the text. */
export type CopyFields = { readonly text: string; readonly phone: string };

export const copyFields = (copy: Copy): CopyFields => ({ text: copy.text, phone: copy.phone ?? "" });

export function copyOf(fields: CopyFields): Copy {
  const text = fields.text.trim();
  const phone = fields.phone.trim();
  return phone === "" ? { text } : { text, phone };
}

/** A title's forced line breaks as lines of text. */
export const titleText = (title: Title): string => (typeof title === "string" ? title : title.join("\n"));

/** Lines of text as a title: one line is a plain string, more are forced breaks. */
export function titleOf(text: string): Title {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length < 2) return lines[0] ?? "";
  const [first, ...rest] = lines;
  return [first, ...rest];
}

/** A text left blank: the trimmed text, or null. */
export const filled = (text: string): string | null => (text.trim() === "" ? null : text.trim());
