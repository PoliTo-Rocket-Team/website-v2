// The rules of the dashboard's one person field (issues #481 and #511,
// components/dashboard/person-combobox.tsx): which rows the list shows for
// what the box reads, and which row the arrow keys make active. A row that
// is taken shows why and can never be chosen, so the arrows step over it.

/** What the field needs of a row to filter it and step through it. */
export type Pickable = {
  readonly name: string;
  /** Why this row cannot be chosen here ("Already a lead"); none when it can. */
  readonly taken?: string | null;
};

/**
 * The people the list shows. A list the server answered is shown as given,
 * since it already answers the text. Otherwise it is the whole list while the
 * box is empty or still reads what is chosen, else the names that hold the
 * typed text, case-insensitive.
 */
export function shownPeople<T extends Pickable>(people: readonly T[], text: string, chosenLabel: string, searched: boolean): readonly T[] {
  if (searched || !filtering(text, chosenLabel)) return people;
  const needle = text.trim().toLowerCase();
  return people.filter((p) => p.name.toLowerCase().includes(needle));
}

/** Whether the box holds typed text that narrows the list, not empty and not what is chosen. */
export function filtering(text: string, chosenLabel: string): boolean {
  return text.trim() !== "" && text !== chosenLabel;
}

export function choosable(row: Pickable): boolean {
  return row.taken === undefined || row.taken === null;
}

/** The active row: the one asked for while it can be chosen, else the first that can; -1 when none can. */
export function activeAt(rows: readonly Pickable[], asked: number): number {
  if (asked >= 0 && asked < rows.length && choosable(rows[asked])) return asked;
  return rows.findIndex(choosable);
}

/** The active row after Arrow Down (1) or Arrow Up (-1): the next row that way that can be chosen, else where it was. */
export function stepActive(rows: readonly Pickable[], from: number, step: 1 | -1): number {
  for (let i = from + step; i >= 0 && i < rows.length; i += step) {
    if (choosable(rows[i])) return i;
  }
  return from;
}
