import { Column, getTableColumns, is, Param, SQL, StringChunk, Table } from "drizzle-orm";

// An in-memory stand-in for the database the dashboard's loaders read
// (issue #477), so the server-side access tests call each loader, action and
// route for real. It runs the Drizzle query builder the loaders write: joins,
// conditions, grouping, aggregates and ordering are evaluated over fixture
// rows, so a filter the loader leaves to SQL is applied here as the database
// would apply it. Every write the loaders could make is recorded and never
// stored: the tests assert that a refused call made none.

const NAME = Symbol.for("drizzle:Name");
const ORIGINAL_NAME = Symbol.for("drizzle:OriginalName");

type DbRow = Record<string, unknown>;
/** One joined row: each table in the query, by its name or alias, and its row (null where a left join found none). */
type Joined = Record<string, DbRow | null>;
type Ctx = { readonly row?: Joined; readonly group?: readonly Joined[] };

/** A write a loader started: its kind and its table. */
export type RecordedWrite = { readonly kind: string; readonly table: string };

const store = new Map<string, DbRow[]>();
const writes: RecordedWrite[] = [];

/** Empties every table and the write record. */
export function resetFakeDb(): void {
  store.clear();
  writes.length = 0;
}

/** The writes started since the last reset. */
export function recordedWrites(): readonly RecordedWrite[] {
  return [...writes];
}

/** Notes a write that did not go through the builder (an audited query, a file store call). */
export function recordWrite(kind: string, table: string): void {
  writes.push({ kind, table });
}

function tableKey(table: Table): string {
  return (table as unknown as Record<symbol, string>)[NAME];
}

function baseName(table: Table): string {
  return (table as unknown as Record<symbol, string>)[ORIGINAL_NAME] ?? tableKey(table);
}

/** Adds rows to a table, written with the schema's field names and stored under its column names. */
export function insertRows(table: Table, rows: readonly Record<string, unknown>[]): void {
  const columns = getTableColumns(table) as Record<string, Column>;
  const stored = store.get(baseName(table)) ?? [];
  for (const row of rows) {
    const record: DbRow = {};
    for (const [field, column] of Object.entries(columns)) record[column.name] = field in row ? row[field] : null;
    for (const field of Object.keys(row)) if (!(field in columns)) throw new Error(`fake db: ${baseName(table)} has no field ${field}`);
    stored.push(record);
  }
  store.set(baseName(table), stored);
}

function rowsOf(table: Table): DbRow[] {
  return store.get(baseName(table)) ?? [];
}

// Expressions ---------------------------------------------------------------

type Template = { readonly text: string; readonly args: readonly unknown[] };

function templateOf(expr: SQL): Template {
  let text = "";
  const args: unknown[] = [];
  for (const chunk of expr.queryChunks) {
    if (is(chunk, StringChunk)) text += chunk.value.join("");
    else {
      text += "?";
      args.push(chunk);
    }
  }
  // A cast changes nothing an in-memory row needs: `count(*)::int` is `count(*)`.
  return { text: text.replace(/::[a-z_]+(\[\])?/g, "").replace(/\s+/g, " ").trim(), args };
}

const STAR = Symbol("*");
const AGGREGATE = /^(count|max|min|sum)\(/;

function isAggregate(expr: unknown): boolean {
  if (is(expr, SQL.Aliased)) return isAggregate(expr.sql);
  if (!is(expr, SQL)) return false;
  const { text, args } = templateOf(expr);
  return AGGREGATE.test(text) || args.some(isAggregate);
}

function comparable(value: unknown): unknown {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const time = Date.parse(value);
    if (!Number.isNaN(time)) return time;
  }
  return value;
}

function compare(a: unknown, b: unknown): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const x = comparable(a);
  const y = comparable(b);
  if (typeof x === "number" && typeof y === "string") return x - Number(y);
  if (typeof x === "string" && typeof y === "number") return Number(x) - y;
  return x === y ? 0 : (x as number) < (y as number) ? -1 : 1;
}

function columnValue(column: Column, row: Joined | undefined): unknown {
  if (row === undefined) throw new Error(`fake db: ${column.name} read outside a row`);
  const key = tableKey(column.table);
  if (!(key in row)) throw new Error(`fake db: column ${key}.${column.name} is not in the query`);
  return row[key]?.[column.name] ?? null;
}

function aggregate(name: string, inner: unknown, ctx: Ctx): unknown {
  if (ctx.group === undefined) throw new Error(`fake db: ${name}() outside a group`);
  const values = ctx.group.map((row) => evaluate(inner, { row }));
  if (name === "count") return values.filter((v) => v === STAR || (v !== null && v !== undefined)).length;
  const present = values.filter((v) => v !== null && v !== undefined);
  if (present.length === 0) return null;
  if (name === "sum") return String(present.reduce((s: number, v) => s + Number(v), 0));
  return present.reduce((best, v) => {
    const order = compare(v, best) ?? 0;
    return (name === "max" ? order > 0 : order < 0) ? v : best;
  });
}

/** The value of an expression for one row, or for a group when it aggregates. */
export function evaluate(expr: unknown, ctx: Ctx): unknown {
  if (is(expr, Column)) return columnValue(expr, ctx.row ?? ctx.group?.[0]);
  if (is(expr, Param)) return expr.value;
  if (is(expr, SQL.Aliased)) return evaluate(expr.sql, ctx);
  if (Array.isArray(expr)) return expr.map((e) => evaluate(e, ctx));
  if (!is(expr, SQL)) return expr;

  const { text, args } = templateOf(expr);
  const at = (i: number) => evaluate(args[i], ctx);
  const truthy = (v: unknown) => v === true;
  const binary = (op: (order: number) => boolean) => {
    const order = compare(at(0), at(1));
    return order === null ? null : op(order);
  };
  if (text === "?" || text === "(?)") return at(0);
  if (text === "*") return STAR;
  if (text === "count(*)") return aggregate("count", STAR, ctx);
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^\?( and \?)+$/.test(text)) return args.every((_, i) => truthy(at(i)));
  if (/^\?( or \?)+$/.test(text)) return args.some((_, i) => truthy(at(i)));
  if (text === "not ?") return !truthy(at(0));
  if (text === "? = ?") return binary((o) => o === 0);
  if (text === "? <> ?") return binary((o) => o !== 0);
  if (text === "? < ?") return binary((o) => o < 0);
  if (text === "? <= ?") return binary((o) => o <= 0);
  if (text === "? > ?") return binary((o) => o > 0);
  if (text === "? >= ?") return binary((o) => o >= 0);
  if (text === "? in ?" || text === "? not in ?") {
    const value = at(0);
    if (value === null) return null;
    const found = (at(1) as unknown[]).some((v) => compare(value, v) === 0);
    return text === "? in ?" ? found : !found;
  }
  if (text === "? is null") return at(0) === null || at(0) === undefined;
  if (text === "? is not null") return at(0) !== null && at(0) !== undefined;
  if (text === "? asc" || text === "? desc") return at(0);
  if (text === "now()") return new Date().toISOString();
  const lower = (v: unknown) => (typeof v === "string" ? v.toLowerCase() : v);
  if (text === "lower(?)") return lower(at(0));
  if (text === "lower(?) = ?") return compare(lower(at(0)), at(1)) === 0;
  if (/^coalesce\(\?(, \?)*\)$/.test(text)) return args.map((_, i) => at(i)).find((v) => v !== null && v !== undefined) ?? null;
  const aggregated = /^(count|max|min|sum)\(\?\)$/.exec(text);
  if (aggregated) return aggregate(aggregated[1], args[0], ctx);
  throw new Error(`fake db: unsupported SQL "${text}"`);
}

/** Whether a condition holds for a row, as SQL reads it: null is false. */
function holds(condition: unknown, row: Joined): boolean {
  return condition === undefined || evaluate(condition, { row }) === true;
}

// Reads ---------------------------------------------------------------------

type Join = { readonly kind: "inner" | "left"; readonly table: Table; readonly on: unknown };
type Order = { readonly expr: unknown; readonly descending: boolean };

function orderOf(expr: unknown): Order {
  if (is(expr, SQL)) {
    const { text, args } = templateOf(expr);
    if (text === "? desc") return { expr: args[0], descending: true };
    if (text === "? asc") return { expr: args[0], descending: false };
  }
  return { expr, descending: false };
}

function tsFields(table: Table, row: DbRow | null): Record<string, unknown> | null {
  if (row === null) return null;
  const columns = getTableColumns(table) as Record<string, Column>;
  return Object.fromEntries(Object.entries(columns).map(([field, column]) => [field, row[column.name] ?? null]));
}

class SelectQuery implements PromiseLike<unknown[]> {
  private source: Table | null = null;
  private readonly joins: Join[] = [];
  private condition: unknown;
  private groups: unknown[] = [];
  private orders: Order[] = [];
  private take: number | null = null;
  private skip = 0;

  constructor(
    private readonly fields: Record<string, unknown> | undefined,
    private readonly distinct: false | true | readonly unknown[],
  ) {}

  from(table: Table) {
    this.source = table;
    return this;
  }
  innerJoin(table: Table, on: unknown) {
    this.joins.push({ kind: "inner", table, on });
    return this;
  }
  leftJoin(table: Table, on: unknown) {
    this.joins.push({ kind: "left", table, on });
    return this;
  }
  where(condition: unknown) {
    this.condition = condition;
    return this;
  }
  groupBy(...exprs: unknown[]) {
    this.groups = exprs.flat();
    return this;
  }
  orderBy(...exprs: unknown[]) {
    this.orders = exprs.flat().map(orderOf);
    return this;
  }
  limit(n: number) {
    this.take = n;
    return this;
  }
  offset(n: number) {
    this.skip = n;
    return this;
  }
  $dynamic() {
    return this;
  }

  private joined(): Joined[] {
    const source = this.source;
    if (source === null) throw new Error("fake db: a select with no from");
    let rows: Joined[] = rowsOf(source).map((r) => ({ [tableKey(source)]: r }));
    for (const join of this.joins) {
      const key = tableKey(join.table);
      rows = rows.flatMap((row) => {
        const matched = rowsOf(join.table)
          .map((r) => ({ ...row, [key]: r }))
          .filter((r) => holds(join.on, r));
        return matched.length > 0 || join.kind === "inner" ? matched : [{ ...row, [key]: null }];
      });
    }
    return rows.filter((row) => holds(this.condition, row));
  }

  private project(ctx: Ctx, fields = this.fields): unknown {
    if (fields === undefined) {
      const source = this.source!;
      const row = ctx.row ?? ctx.group?.[0];
      if (this.joins.length === 0) return tsFields(source, row?.[tableKey(source)] ?? null);
      return Object.fromEntries([source, ...this.joins.map((j) => j.table)].map((t) => [tableKey(t), tsFields(t, row?.[tableKey(t)] ?? null)]));
    }
    return Object.fromEntries(
      Object.entries(fields).map(([name, expr]) => {
        const nested = expr !== null && typeof expr === "object" && !is(expr, Column) && !is(expr, SQL) && !is(expr, SQL.Aliased);
        return [name, nested ? this.project(ctx, expr as Record<string, unknown>) : evaluate(expr, ctx)];
      }),
    );
  }

  private run(): unknown[] {
    const rows = this.joined();
    const grouped = this.groups.length > 0 || Object.values(this.fields ?? {}).some(isAggregate);
    let ctxs: Ctx[];
    if (grouped) {
      const byKey = new Map<string, Joined[]>();
      for (const row of rows) {
        const key = JSON.stringify(this.groups.map((g) => evaluate(g, { row })));
        byKey.set(key, [...(byKey.get(key) ?? []), row]);
      }
      ctxs = this.groups.length === 0 && byKey.size === 0 ? [{ group: [] }] : [...byKey.values()].map((group) => ({ group }));
    } else ctxs = rows.map((row) => ({ row }));

    for (const order of [...this.orders].reverse()) {
      ctxs = [...ctxs].sort((a, b) => {
        const x = evaluate(order.expr, a);
        const y = evaluate(order.expr, b);
        if (x === null && y === null) return 0;
        // Postgres puts nulls last going up, first going down.
        if (x === null) return order.descending ? -1 : 1;
        if (y === null) return order.descending ? 1 : -1;
        const c = compare(x, y) ?? 0;
        return order.descending ? -c : c;
      });
    }
    if (Array.isArray(this.distinct)) {
      const seen = new Set<string>();
      ctxs = ctxs.filter((ctx) => {
        const key = JSON.stringify((this.distinct as unknown[]).map((e) => evaluate(e, ctx)));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    let projected = ctxs.map((ctx) => this.project(ctx));
    if (this.distinct === true) {
      const seen = new Set<string>();
      projected = projected.filter((p) => {
        const key = JSON.stringify(p);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return projected.slice(this.skip, this.take === null ? undefined : this.skip + this.take);
  }

  then<A = unknown[], B = never>(onfulfilled?: ((value: unknown[]) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onfulfilled, onrejected);
  }
  execute() {
    return this.then((rows) => rows);
  }
}

// Writes --------------------------------------------------------------------

/** The id an insert answers for the row it would have made. */
const WRITTEN_ID = 9_000;

/**
 * A write, never stored. An update or a delete changes the rows its
 * condition matches, as on the database, and is recorded only when it
 * matches one, so a write guarded in its condition (the notice must be the
 * viewer's own) is no write when the guard holds it back. An insert always
 * writes. `returning` answers the rows written: the matched rows, or for an
 * insert one row holding the written id.
 */
class WriteQuery implements PromiseLike<unknown[]> {
  private condition: unknown;
  private returned: Record<string, unknown> | null = null;
  constructor(
    private readonly kind: "insert" | "update" | "delete",
    private readonly table: Table,
  ) {}
  values() {
    return this;
  }
  set() {
    return this;
  }
  where(condition: unknown) {
    this.condition = condition;
    return this;
  }
  returning(fields?: Record<string, unknown>) {
    this.returned = fields ?? getTableColumns(this.table);
    return this;
  }
  onConflictDoUpdate() {
    return this;
  }
  onConflictDoNothing() {
    return this;
  }

  /** The rows the write changes; a condition the fake cannot read counts every row, so it never hides a write. */
  private changed(): Joined[] {
    const key = tableKey(this.table);
    const rows = rowsOf(this.table).map((r) => ({ [key]: r }));
    if (this.kind === "insert") return [{ [key]: null }];
    return rows.filter((row) => {
      try {
        return holds(this.condition, row);
      } catch {
        return true;
      }
    });
  }

  private run(): unknown[] {
    const changed = this.changed();
    if (changed.length > 0) recordWrite(this.kind, baseName(this.table));
    const fields = this.returned;
    if (fields === null) return [];
    if (this.kind === "insert") return [Object.fromEntries(Object.keys(fields).map((f) => [f, WRITTEN_ID]))];
    return changed.map((row) => Object.fromEntries(Object.entries(fields).map(([f, expr]) => [f, evaluate(expr, { row })])));
  }

  then<A = unknown[], B = never>(onfulfilled?: ((value: unknown[]) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onfulfilled, onrejected);
  }
}

/** Raw SQL: a select of the next id answers one; anything else is a write, recorded, answering one row whose every id is the written id. */
function execute(query: SQL): Promise<{ rows: unknown[] }> {
  const { text } = templateOf(query);
  if (/^select nextval\(/.test(text)) return Promise.resolve({ rows: [{ id: WRITTEN_ID }] });
  recordWrite("execute", text.slice(0, 40));
  const row = new Proxy({}, { get: (_, key) => (typeof key === "string" && /id$/.test(key) ? WRITTEN_ID : undefined) });
  return Promise.resolve({ rows: [row] });
}

/** The fake `getDb()` answer. */
export const fakeDb = {
  select: (fields?: Record<string, unknown>) => new SelectQuery(fields, false),
  selectDistinct: (fields?: Record<string, unknown>) => new SelectQuery(fields, true),
  selectDistinctOn: (on: readonly unknown[], fields?: Record<string, unknown>) => new SelectQuery(fields, on),
  insert: (table: Table) => new WriteQuery("insert", table),
  update: (table: Table) => new WriteQuery("update", table),
  delete: (table: Table) => new WriteQuery("delete", table),
  execute,
  batch: (items: readonly PromiseLike<unknown>[]) => Promise.all(items),
};
