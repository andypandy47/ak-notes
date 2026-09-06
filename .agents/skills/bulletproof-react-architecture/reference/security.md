# Security: authentication and authorization

Client-side auth improves the user experience but doesn't replace server-side enforcement. Every resource still needs to be protected on the server. What follows is how to wire up the client side; it's complementary, not a replacement.

## Authentication

Standard pattern for SPAs is JWT: the user logs in, receives a token, and the token is sent with every authenticated request.

**Where to store the token matters:**

- **Application state only.** Most secure against theft, but resets on page refresh. Not practical on its own.
- **`localStorage` / `sessionStorage`.** Readable by any JavaScript on the page. If the app has an XSS vulnerability, the token can be stolen directly.
- **HttpOnly cookies.** Safer default. Not accessible to client-side JavaScript, which closes the XSS token-theft path.

Sanitize all user input before rendering it. That's the other half of XSS defense. Storage security alone doesn't help if unsanitized input gets rendered back into the page.

The upstream repo uses **react-query-auth** to wire up auth. In `lib/auth.tsx`, call `configureAuth` with your API functions, then export typed hooks (see [api-layer.md](api-layer.md) for the pattern). The app considers a user authenticated if and only if a user object is present.

## Authorization

Two models. You can use both in the same app.

**Role-based (RBAC):** Define roles (`USER`, `ADMIN`) and grant each role a set of permissions. Simple. Right default for most access decisions.

**Permission-based (PBAC):** Finer-grained. Use it when access depends on something more specific than role membership, most commonly ownership: only the author of a comment can delete it. RBAC alone can't express that.

### The Authorization component pattern

The upstream repo has `lib/authorization.tsx` with a reusable component. It takes either `allowedRoles` (RBAC) or a `policyCheck` function (PBAC) and renders children only when access is granted.

```tsx
// RBAC. Only admins can see this
<Authorization allowedRoles={['ADMIN']}>
  <DeleteUserButton />
</Authorization>

// PBAC. Only the comment author can delete
// Evaluate the policy and pass the boolean result
<Authorization policyCheck={POLICIES['comment:delete'](user, comment)}>
  <DeleteCommentButton />
</Authorization>
```

Define roles and policies in one place:

```ts
export enum ROLES {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

const POLICIES = {
  'comment:delete': (user: User, comment: Comment) => {
    if (user.role === ROLES.ADMIN) return true;
    if (user.role === ROLES.USER && comment.author?.id === user.id) return true;
    return false;
  },
} as const;
```

The `useAuthorization` hook returns `checkAccess` and `role` so you can use them in logic too, not just in JSX.
