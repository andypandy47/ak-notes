# API layer

## One API client instance

Create a single preconfigured API client and reuse it everywhere. The upstream repo uses an Axios instance in `lib/api-client.ts` with an `authRequestInterceptor` that sets the Accept header, enables credentials, and extracts `response.data`. On errors, it shows a toast and redirects to login on 401.

Don't construct a new client per call. One instance, configured once.

## Declare requests separately, don't inline them

Each endpoint gets its own file in the feature's `api/` folder. This makes every endpoint discoverable and keeps typing straightforward.

Before recommending this pattern, check scale: a single one-off call that won't be reused is fine to leave inline (see [overengineering-check.md](overengineering-check.md)). This pattern pays off once a second consumer, a second endpoint, or a real feature folder exists.

Each file has three parts:

1. **Types and validation schemas** for the request and response
2. **A fetcher function** that calls the endpoint using the shared API client
3. **A hook or `queryOptions`** that wraps the fetcher for caching, loading state, and refetching

```
features/discussions/api/
├── get-discussions.ts
└── create-discussion.ts
```

## Use `queryOptions` for TanStack Query v5

Instead of writing raw `useQuery` calls inline, export a `queryOptions` object. This lets you reuse the same query configuration across `useQuery`, `prefetchQuery`, and `queryClient.invalidateQueries` with full type inference.

```ts
export const getDiscussionsQueryOptions = ({ page }) => {
  return queryOptions({
    queryKey: page ? ['discussions', { page }] : ['discussions'],
    queryFn: () => getDiscussions(page),
  });
};
```

Then consume it:

```ts
const { data } = useQuery(getDiscussionsQueryOptions({ page }));
```

Or prefetch before the user navigates:

```ts
queryClient.prefetchQuery(getDiscussionsQueryOptions({ page: 1 }));
```

## Auth pattern with react-query-auth

The upstream repo uses `react-query-auth` to wire up authentication. In `lib/auth.tsx`, call `configureAuth` once with your `getUser`, `login`, `register`, and `logout` functions. Export the hooks you need:

```ts
const { useUser, useLogin, useLogout, useRegister, AuthLoader, ProtectedRoute } =
  configureAuth({
    userFn: getProfile,
    loginFn: loginWithEmailAndPassword,
    registerFn: registerWithEmailAndPassword,
    logoutFn: logout,
  });
```

This gives you typed hooks for all auth operations. `AuthLoader` renders a spinner while the user object loads. `ProtectedRoute` redirects unauthenticated users to the login page.

The same pattern works for any backend. The login and register functions are just async calls that return a user object and set the token.
