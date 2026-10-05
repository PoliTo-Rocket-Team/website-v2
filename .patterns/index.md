# Patterns

How the code is shaped today. Each doc names the shape, cites real call sites, and lists the
inconsistencies it found, so a reader does not copy them. Why a choice was made belongs in
`.decisions/`; visual rules belong in [design-system-manifest.md](../design-system-manifest.md).

Read only the rows that match your change.

## Data and server code

| Pattern | Topic | Read when |
|---|---|---|
| [drizzle-reads.md](./drizzle-reads.md) | Server-only reads with Drizzle: getDb per call, snake_case selections, cached snapshots filtered by scope | Adding or changing a query in app/actions, or caching a read |
| [audited-mutations.md](./audited-mutations.md) | Server actions that write through runAuditQuery and invalidate cache tags | Adding or changing any write to an app table |

## Auth and access

| Pattern | Topic | Read when |
|---|---|---|
| [scope-access.md](./scope-access.md) | Better Auth session, proxy cookie gate, getCurrentUserId, and ScopeInfo per target | Showing member-only data, or adding an access check to a page, route or action |

## Database schema

| Pattern | Topic | Read when |
|---|---|---|
| [schema-migrations.md](./schema-migrations.md) | db/schema edits, generated and hand-written migrations in drizzle/, the journal, and the audit trigger | Changing a table, enum, index, trigger or function |

## UI

| Pattern | Topic | Read when |
|---|---|---|
| [client-form-submit.md](./client-form-submit.md) | Client forms: ui primitives, local state, validate, call auth client or action prop, toast | Building or changing a form or a control that submits to the server |

## When to add a new pattern doc here

Add a doc only when all of these hold:

- The shape repeats in at least two real call sites in this repo, and the doc cites them by path.
- It is not obvious: a new contributor would likely build it a worse way without the doc.
- Every rule traces to code you read. Anything the code does not enforce is cut, or listed under
  "Known inconsistencies" as a fact, not a rule.
- No existing doc covers it. If one does, extend that doc instead.

When the code changes a shape, update its doc in the same change.
