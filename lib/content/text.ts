/** The length a text limit counts: code points, so "ò" is one character, as Postgres' char_length counts. */
export function textLength(text: string): number {
  return [...text].length;
}
