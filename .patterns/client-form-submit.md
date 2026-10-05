# Client form submit

How a client form is built and submitted today: a `"use client"` component composes
`components/ui/` primitives, keeps field state in `useState`, validates on submit, calls an auth
client method or a server action passed in as a prop, and reports the result with a `sonner` toast.

## The shape

1. **Compose from `components/ui/`.** Forms build from the shadcn primitives (`Button`, `Input`,
   `Card`, `Dialog`/`AlertDialog`, `Select`, `Switch`, the `Field*` set in
   [components/ui/field.tsx](../components/ui/field.tsx)) and merge classes with `cn` from
   [lib/utils.ts](../lib/utils.ts). The visual rules are in
   [design-system-manifest.md](../design-system-manifest.md); this doc covers only the code flow.
   `components.json` records the shadcn setup (`style: "default"`, `rsc: true`, alias `@/components`).

2. **Local state, then validate on submit.** Each form holds its values, an `errors` record and a
   loading flag in `useState`. On submit it calls `e.preventDefault()`, sets loading, and
   validates. The auth forms use a `zod` schema with `safeParse` and copy each issue into
   `errors` by its first path segment:

   ```ts
   const result = forgotPasswordSchema.safeParse({ email });
   if (!result.success) {
     const fieldErrors: Record<string, string> = {};
     result.error.issues.forEach(error => {
       if (error.path[0]) fieldErrors[error.path[0] as string] = error.message;
     });
     setErrors(fieldErrors);
     setIsLoading(false);
     toast.error("Please enter a valid email address");
     return;
   }
   ```
   ([components/forgot-password-dialog.tsx](../components/forgot-password-dialog.tsx); the same in
   [login-form.tsx](../components/login-form.tsx), [signup-form.tsx](../components/signup-form.tsx),
   [reset-password-form.tsx](../components/reset-password-form.tsx))

3. **Call the backend.** Auth forms call Better Auth's client from
   [lib/auth-client.ts](../lib/auth-client.ts) (`signIn.email`, `signUp.email`,
   `authClient.requestPasswordReset`, `authClient.resetPassword`,
   `authClient.sendVerificationEmail`). Data forms call a server action they got as a prop
   (`onAddPosition` in [add-position-dialog.tsx](../components/add-position-dialog.tsx); the
   handlers in [apply-positions-list.tsx](../components/apply-positions-list.tsx)). See
   [audited-mutations.md](./audited-mutations.md) for the action side.

4. **Toast the outcome.** `toast.success` / `toast.error` from `sonner`, rendered by the single
   `<Toaster />` in [app/layout.tsx](../app/layout.tsx). Data forms pass a `description` and a
   `duration`, and show `err.message` when the error is an `Error`:

   ```ts
   } catch (error) {
     console.error("Failed to create position:", error);
     toast.error("Failed to create position", {
       description: error instanceof Error ? error.message
         : "Please try again or contact support if the problem persists.",
       duration: 5000,
     });
   } finally {
     setIsSubmitting(false);
   }
   ```

5. **Update local state on success.** List components keep a local copy of the server data
   (`useState(initialPositions)`, re-synced in `useEffect`) and patch it after the action resolves,
   instead of reloading the page.

## When this applies

Any interactive form or control that submits to the server, in `components/`. The landing page in
`components/landing/` has no forms. There are no component tests.

## Why it is not obvious

- Better Auth's client returns errors as values (`{ data, error }`) or through `onError`, not by
  throwing. The auth forms check `error` and the HTTP status (`login-form.tsx` opens the
  email-verification dialog on 403). A plain `try/catch` alone would miss these.
- Server actions do throw, so data forms wrap them in `try/catch/finally` to clear the loading flag.

## Known inconsistencies (not the pattern)

- **Two validation helpers.** Auth forms use `zod` with per-field errors. The position forms
  ([add-position-dialog.tsx](../components/add-position-dialog.tsx),
  [position-edit-form.tsx](../components/position-edit-form.tsx)) use the hand-rolled
  `createValidationRules` + `validateAndShowErrors` in [lib/validation.ts](../lib/validation.ts),
  which only toasts and keeps no per-field errors. Neither is shared with the server.
- **Loading flag reset.** Auth forms reset loading by hand in each branch; data forms use
  `finally`.
- **Mixed primitive styles.** Most `components/ui/` files use `React.forwardRef` (older shadcn);
  `field.tsx` uses plain function components with `data-slot` (newer shadcn).
