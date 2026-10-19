// A dashboard table's column filters (boards 73b and 73c, issue #428): a tick
// per value a column holds, with how many rows hold it. Within a column any
// ticked value matches; across columns all must. The Members table and the
// Applications table each name their columns and what a row holds in each;
// the rules here are one for both.

/** A table's filtered columns, and what a row holds in each: each value, or none for an empty field. */
export type ColumnFilters<R, C extends string> = {
  readonly columns: readonly C[];
  readonly values: (row: R, column: C) => readonly string[];
};

/** The values ticked in each filtered column; a column with none ticked does not narrow. */
export type ColumnPicks<C extends string> = Readonly<Partial<Record<C, readonly string[]>>>;

export type ColumnOption = { readonly value: string; readonly count: number };

function matchesPicks<R, C extends string>(filters: ColumnFilters<R, C>, row: R, picks: ColumnPicks<C>, skip: C | null): boolean {
  return filters.columns.every((column) => {
    const ticked = picks[column];
    if (column === skip || ticked === undefined || ticked.length === 0) return true;
    return filters.values(row, column).some((value) => ticked.includes(value));
  });
}

/** The rows every column's ticks leave, in the order they came. */
export function rowsWithPicks<R, C extends string>(filters: ColumnFilters<R, C>, rows: readonly R[], picks: ColumnPicks<C>): R[] {
  return rows.filter((row) => matchesPicks(filters, row, picks, null));
}

/**
 * A column's popover (board 73c): each value with how many rows hold it,
 * counted over the rows the other columns' ticks leave, most first, then by
 * name. A column's own ticks do not shrink its own list.
 */
export function optionsOf<R, C extends string>(filters: ColumnFilters<R, C>, rows: readonly R[], picks: ColumnPicks<C>, column: C): ColumnOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!matchesPicks(filters, row, picks, column)) continue;
    for (const value of new Set(filters.values(row, column))) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** The picks with one value ticked or unticked in one column. */
export function togglePickIn<C extends string>(picks: ColumnPicks<C>, column: C, value: string): ColumnPicks<C> {
  const ticked = picks[column] ?? [];
  const next = ticked.includes(value) ? ticked.filter((v) => v !== value) : [...ticked, value];
  return { ...picks, [column]: next };
}

/** The picks with one column cleared. */
export function clearPicksIn<C extends string>(picks: ColumnPicks<C>, column: C): ColumnPicks<C> {
  return { ...picks, [column]: [] };
}
