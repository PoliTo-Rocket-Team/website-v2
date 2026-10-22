# Client form submit

How a client form is built and submitted today: a `"use client"` component composes
`components/ui/` primitives, keeps field state in `useState`, validates on submit, calls an auth
client method or a server action, and reports the result with a `sonner` toast.

## The shape

1. **Compose from `components/ui/`.** Forms build from the shadcn primitives (`Button`, `Input`,
   `Card`, `Dialog`/`AlertDialog`, `Select`, `Switch`, the `Field*` set in
   [components/ui/field.tsx](../components/ui/field.tsx)) and merge classes with `cn` from
   [lib/utils.ts](../lib/utils.ts). The visual rules are in
   [design-system-manifest.md](../design-system-manifest.md); this doc covers only the code flow.
   `components.json` records the shadcn setup (`style: "default"`, `rsc: true`, alias `@/components`).

2. **Local state, then validate on submit.** Each form holds its values and a loading flag in
   `useState`. On submit it calls `e.preventDefault()`, sets loading, and validates. The email
   and password forms that used a `zod` schema with `safeParse` were removed with email sign-in
   (issue #118). The application form ([application-form.tsx](../components/apply/application-form.tsx))
   validates with the `zod` schema in [lib/apply/application-form.ts](../lib/apply/application-form.ts),
   and its server action parses the same FormData with the same schema.

3. **Call the backend.** The one auth control, the Google button in
   [login-form.tsx](../components/login-form.tsx), calls `signIn.social` from
   [lib/auth-client.ts](../lib/auth-client.ts). Data forms import a server action and call it
   (`createPosition` and `editPosition` from
   [app/dashboard/recruitment-actions.ts](../app/dashboard/recruitment-actions.ts) in
   [new-position-drawer.tsx](../components/dashboard/new-position-drawer.tsx)). See
   [audited-mutations.md](./audited-mutations.md) for the action side.

4. **Toast the outcome.** `toast.success` / `toast.error` from `sonner`, rendered by the single
   `<Toaster />` in [app/layout.tsx](../app/layout.tsx). The dashboard actions answer a
   `WriteResult` ([lib/dashboard/write.ts](../lib/dashboard/write.ts)) instead of throwing, so the
   form toasts the refusal it gets back and clears the loading flag in `finally`
   ([new-position-drawer.tsx](../components/dashboard/new-position-drawer.tsx)):

   ```ts
   try {
     const result = await createPosition(checked.position);
     if (!result.ok) {
       toast.error(result.error);
       return;
     }
     toast.success(`${checked.position.title} is saved as ${result.value.code}`);
     close(false);
   } finally {
     setSubmitting(false);
   }
   ```

5. **Show the change at once.** A control that flips a saved value shows the new value with
   `useOptimistic` inside a transition, and a refusal flips it back with a toast
   (`useOptimisticSwitch` in [positions.tsx](../components/dashboard/positions.tsx)). The server
   write refreshes the cache tags, so the page re-renders with the saved rows instead of
   reloading.

## When this applies

Any interactive form or control that submits to the server, in `components/`. The landing page in
`components/landing/` has no forms. There are no component tests.

## Why it is not obvious

- Better Auth's client returns errors as values (`{ data, error }`) or through `onError`, not by
  throwing. A plain `try/catch` alone would miss these.
- The dashboard actions return a refusal as a value, but an unexpected server error still throws,
  so data forms clear the loading flag in `finally`.

## Known inconsistencies (not the pattern)

- **Two validation helpers.** The application form uses `zod`, shared with its server action. The
  position drawer ([new-position-drawer.tsx](../components/dashboard/new-position-drawer.tsx))
  uses the hand-written `checkNewPosition` / `checkPositionContent` in
  [lib/dashboard/new-position.ts](../lib/dashboard/new-position.ts), which keep per-field errors
  and run again on the server.
- **Loading flag reset.** Auth forms reset loading by hand in each branch; data forms use
  `finally`.
- **Mixed primitive styles.** Most `components/ui/` files use `React.forwardRef` (older shadcn);
  `field.tsx` uses plain function components with `data-slot` (newer shadcn).
