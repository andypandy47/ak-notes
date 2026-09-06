<!-- GENERATED FILE. Do not edit directly. -->
<!-- Source: SKILL.md and reference/*.md in this skill's directory. -->
<!-- Regenerate with: python scripts/build_agents_md.py -->

# Bulletproof React architecture

Conventions adapted from [bulletproof-react](https://github.com/alan2207/bulletproof-react), MIT licensed.

# Project structure

The upstream repo is a monorepo with three app variants: `apps/react-vite/`, `apps/nextjs-app/`, `apps/nextjs-pages/`. Everything below follows the `react-vite` version.

## Contents

- [Top-level layout](#top-level-layout)
- [Config patterns](#config-patterns)
- [Feature folder layout](#feature-folder-layout)
- [Import rules](#import-rules)
- [Additional ESLint rules](#additional-eslint-rules)
- [Avoid barrel files](#avoid-barrel-files)

## Top-level layout

Most code lives under `src/`:

```
src/
├── app/            # routes, root app component, providers, router config
├── assets/         # static files: images, fonts
├── components/     # shared components used across the whole app
├── config/         # global config, exported env variables
├── features/       # feature-based modules, most code lives here
├── hooks/          # shared hooks
├── lib/            # reusable libraries, preconfigured for the app
├── testing/        # test utilities and mocks
├── types/          # shared types
└── utils/          # shared utility functions
```

(The original docs also list `stores/` for global state, but the current codebase keeps stores colocated in features or uses Zustand ad-hoc without a top-level stores directory.)

### Config patterns

The `config/` folder has two files worth noting:

**`env.ts`** uses Zod to validate environment variables at runtime. It reads from `import.meta.env`, strips the `VITE_APP_` prefix, validates against a schema, and throws a detailed error if validation fails. This catches misconfigured deployments before they cause silent failures.

```ts
const envSchema = z.object({
  API_URL: z.string().url(),
  APP_URL: z.string().url().optional(),
  ENABLE_API_MOCKING: z.boolean().default(false),
});
```

**`paths.ts`** defines route paths centrally with a `path` and `getHref()` for each route. This keeps navigation type-safe and avoids hardcoded path strings scattered across components.

```
src/config/
├── env.ts
└── paths.ts
```

## Feature folder layout

Each feature under `src/features/` gets its own folder. Only create the subdirectories a feature actually needs.

```
src/features/awesome-feature/
├── api/            # API request declarations and hooks for this feature
├── assets/         # static files scoped to this feature
├── components/     # components scoped to this feature
├── hooks/          # hooks scoped to this feature
├── stores/         # state stores scoped to this feature
├── types/          # types used within this feature
└── utils/          # utility functions for this feature
```

A small feature might just have `api/` and `components/`. Add folders when they earn their keep.

If a lot of API calls are shared across features, keep a dedicated top-level `api/` folder instead of duplicating fetchers per feature.

## Import rules

**No cross-feature imports.** `features/discussions` should never import from `features/comments`. Pull shared logic into `components/`, `hooks/`, `lib/`, or `utils/`. Compose features at the app layer, not by reaching into each other.

**Imports flow one direction: shared → features → app.** Shared code can be used anywhere. Features can use shared code but not other features. The app layer can use features and shared code. Nothing shared imports from a feature or from `app/`.

Enforce with ESLint's `import/no-restricted-paths`:

```js
'import/no-restricted-paths': [
  'error',
  {
    zones: [
      // no cross-feature imports
      {
        target: './src/features/auth',
        from: './src/features',
        except: ['./auth'],
      },
      {
        target: './src/features/comments',
        from: './src/features',
        except: ['./comments'],
      },
      // repeat per feature

      // unidirectional flow: app can import from features
      {
        target: './src/features',
        from: './src/app',
      },
      // features and app can import shared modules
      {
        target: [
          './src/components',
          './src/hooks',
          './src/lib',
          './src/types',
          './src/utils',
        ],
        from: ['./src/features', './src/app'],
      },
    ],
  },
],
```

## Additional ESLint rules

The repo also uses these. Not all are mandatory on day one, but add them as the codebase grows:

- **`import/no-cycle`.** Prevents circular dependencies. Worth adding early, circular deps are hard to untangle later.
- **`import/order`.** Enforces consistent import grouping and alphabetical ordering. Optional but reduces noise in diffs.
- **`check-file/filename-naming-convention`** and **`check-file/folder-naming-convention`.** Enforces `KEBAB_CASE` for all files and folders. Use from the start if you care about naming consistency; skip it if you're prototyping.

## Avoid barrel files

Don't use barrel files (an `index.ts` that re-exports everything from a feature). They break tree shaking in Vite. Import directly from the specific file.

This structure applies to Next.js, Remix, and React Native. Only the `app/` folder's internals differ based on the meta-framework.

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

# State management

Before reaching for a global store, figure out which of these five categories the state belongs to. Most bugs and unnecessary re-renders come from putting state one level higher than it needs to be.

## Component state

State used by one component and its children. Start here. Only lift state higher if something outside the component tree needs it.

- `useState` for simple values
- `useReducer` when one action updates several related pieces of state at once

## Application state

Global, cross-cutting state: modal visibility, notifications, color mode. Keep this category small. Don't globalize state just because it's convenient.

The upstream repo uses **Zustand**. It's a good default: simple API, no boilerplate, no provider wrapping, built-in selectors to avoid unnecessary re-renders. Alternatives exist (Redux Toolkit, Jotai, MobX, context + hooks) but Zustand covers most needs with less code.

Usage in the repo: `useNotifications.getState()` in the API client interceptor to surface error toasts. No store directory at the top level. Stores are colocated in features or used ad-hoc via Zustand.

## Server cache state

Data that originated on the server and is cached client-side. Don't put this in a general-purpose store like Zustand or Redux. Use TanStack Query, SWR, Apollo, or RTK Query. These handle caching, invalidation, and refetching in ways a plain store doesn't.

The upstream repo uses **TanStack Query v5** with the `queryOptions` pattern (see [api-layer.md](api-layer.md)). Stale time is set to 60 seconds by default, no refetch on window focus, no retry.

## Form state

Use a form library: React Hook Form, Formik, or React Final Form. The upstream repo uses **React Hook Form** with **Zod** for validation. Wrap the library in a small `Form` component plus reusable field components so the rest of the app doesn't touch the library's API directly.

## URL state

Data in the URL: route params, query params. Use the router to read and update it. Don't mirror it into component or application state. The URL is the source of truth.

The upstream repo uses **react-router v7** (not `react-router-dom`). Route paths are defined centrally in `config/paths.ts` with type-safe `path` and `getHref()` helpers.

# Testing

Weight testing effort toward integration tests. Unit tests catch isolated bugs, but they don't tell you the pieces work together. That's where real breakage happens.

## Test types

**Unit tests.** One function or component in isolation. Good for shared components, utilities, and complex logic inside a single component. Fast and cheap, write them freely.

**Integration tests.** How multiple parts work together. This is where most testing effort should go. Unit tests can't see broken connections between components, hooks, and API calls.

**End-to-end tests.** Full app, frontend and backend, driven like a real user. Expensive to write and run. Write fewer of these, but treat them as the strongest signal.

## Tooling

**Vitest.** Test runner. Jest-compatible API, faster, better build tool integration.

**Testing Library.** Tests what the user sees and does, not internal state. Swap out a state management library, and tests against rendered output shouldn't change.

**Playwright.** E2E tests. Run in browser mode locally for visual debugging, headless in CI.

**MSW.** Intercepts real HTTP calls and returns mocked responses. Useful when the API isn't finished. In tests, you make real HTTP calls, MSW answers them, and you avoid mocking `fetch`.

## Upstream repo patterns

### renderApp helper

The test utility exports `renderApp` which creates a memory router, wraps in the app provider, and optionally authenticates a user.

```ts
import { renderApp, createUser } from '@/testing/test-utils';

it('displays the discussion list', async () => {
  const user = await createUser();
  const { findByText } = renderApp(<DiscussionsPage />, { user });
  expect(await findByText('My Discussion')).toBeInTheDocument();
});
```

This sets up everything: router, providers, auth, data loading. You don't rewire these per test.

### In-memory database with MSW data

`@mswjs/data` creates an in-memory database with typed models. Combined with MSW, API calls during tests hit this database instead of a real server.

```ts
// db.ts
import { factory, primaryKey } from '@mswjs/data';
import { nanoid } from '@ngneat/falso';

const models = {
  user: {
    id: primaryKey(nanoid),
    firstName: String,
    lastName: String,
    email: String,
    role: String,
  },
  discussion: {
    id: primaryKey(nanoid),
    title: String,
    body: String,
    authorId: String,
  },
};

export const db = factory(models);
```

Write to it directly in tests via `db.user.create(...)` / `db.discussion.create(...)`.

### Data generators

`@ngneat/falso` generates realistic fake data. Combine with the in-memory DB for seeded test scenarios.

```ts
import { randCompanyName, randUserName, randEmail, randParagraph, randUuid } from '@ngneat/falso';

export const generateUser = () => ({
  id: randUuid(),
  firstName: randUserName(),
  lastName: randUserName(),
  email: randEmail(),
});
```

Note: the data generator returns plain objects. The `db.user.create(...)` call that inserts into the database happens in the test utilities or setup, not in the generator itself.

### Standalone mock server for E2E

The repo includes a standalone mock server using `vite-node` and `@mswjs/http-middleware`. It runs the same MSW handlers as the test suite but as an HTTP server, so Playwright E2E tests hit a real API without standing up a backend.

# Error handling

## API errors

Handle them in one place: an interceptor on the API client. Use it to surface error toasts, log out a user whose session expired, or trigger a token refresh. Don't scatter error handling across every call site.

## In-app errors

Use multiple error boundaries, not one boundary wrapping the entire app. A single top-level boundary means any error anywhere takes down the whole UI. Placing boundaries around independent sections lets a failure in one part stay contained there while the rest of the app keeps working.

## Error tracking

Track production errors with a dedicated service (Sentry or similar) rather than building your own. You get the browser, platform, and user context around each error for free, and you need source maps uploaded to see where the error actually happened in your original code, not in minified output.

# Effects: You might not need one

Effects let you step outside React to synchronize components with external systems like network requests, browser DOM, or non-React widgets. If there is no external system involved, you should not need an Effect. Agents overuse Effects for transforming data and handling user events. Removing unnecessary Effects makes code easier to follow, faster to run, and less error-prone.

## Contents

- [When to remove Effects](#when-to-remove-effects)
- [Updating state based on props or state](#updating-state-based-on-props-or-state)
- [Caching expensive calculations](#caching-expensive-calculations)
- [Resetting all state when a prop changes](#resetting-all-state-when-a-prop-changes)
- [Adjusting some state when a prop changes](#adjusting-some-state-when-a-prop-changes)
- [Sharing logic between event handlers](#sharing-logic-between-event-handlers)
- [Sending a POST request](#sending-a-post-request)
- [Chains of computations](#chains-of-computations)
- [Initializing the application](#initializing-the-application)
- [Notifying parent components about state changes](#notifying-parent-components-about-state-changes)
- [Passing data to the parent](#passing-data-to-the-parent)
- [Subscribing to an external store](#subscribing-to-an-external-store)
- [Fetching data](#fetching-data)
- [Companion: ESLint plugin](#companion-eslint-plugin)

## When to remove Effects

There are two common cases where you do not need Effects:

1. You do not need Effects to transform data for rendering. If you want to filter a list before displaying it, do not write an Effect that updates a state variable when the list changes. That is inefficient. React calls your component functions to calculate what should be on the screen, commits those changes to the DOM, and then runs your Effects. If your Effect immediately updates state, it restarts the whole process from scratch. Transform data at the top level of your components instead. That code automatically re-runs whenever your props or state change.
2. You do not need Effects to handle user events. If you want to send a POST request when a user buys a product, do it in the Buy button click event handler. By the time an Effect runs, you do not know what the user did. Handle user events in their corresponding event handlers.

You do need Effects to synchronize with external systems. You can write an Effect that keeps a jQuery widget synchronized with React state. You can also fetch data with Effects to synchronize search results with the current query. Modern frameworks provide more efficient built-in data fetching mechanisms than writing Effects directly in components.

## Updating state based on props or state

Suppose you have a component with `firstName` and `lastName` state variables. You want to calculate `fullName` from them and update it whenever they change. Do not add a `fullName` state variable and update it in an Effect.

```jsx
function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');
  // Avoid: redundant state and unnecessary Effect
  const [fullName, setFullName] = useState('');
  useEffect(() => {
    setFullName(firstName + ' ' + lastName);
  }, [firstName, lastName]);
  // ...
}
```

This does an entire render pass with a stale value for `fullName`, then immediately re-renders with the updated value. Remove the state variable and the Effect. Calculate it during rendering.

```jsx
function Form() {
  const [firstName, setFirstName] = useState('Taylor');
  const [lastName, setLastName] = useState('Swift');
  // Good: calculated during rendering
  const fullName = firstName + ' ' + lastName;
  // ...
}
```

If something can be calculated from existing props or state, do not put it in state. Calculate it during rendering.

## Caching expensive calculations

If you filter a list of todos based on a filter prop, calculating it during rendering is fine if the operation is fast. If `getFilteredTodos` is slow or you have a large list, you can memoize the calculation with `useMemo`. Do not use an Effect to store the result in state.

```jsx
import { useMemo, useState } from 'react';

function TodoList({ todos, filter }) {
  const [newTodo, setNewTodo] = useState('');

  const visibleTodos = useMemo(() => {
    // Does not re-run unless todos or filter change
    return getFilteredTodos(todos, filter);
  }, [todos, filter]);
  // ...
}
```

React will remember the return value of `getFilteredTodos` during the initial render. On the next renders, it checks if `todos` or `filter` are different. If they are the same, `useMemo` returns the last result. If they are different, React calls the inner function again.

The React Compiler can automatically memoize expensive calculations for you, eliminating the need for manual `useMemo` in many cases. The function you wrap in `useMemo` runs during rendering, so this only works for pure calculations.

To tell if a calculation is expensive, you can add a console log to measure the time spent. If the overall logged time adds up to a significant amount, like 1ms or more, it might make sense to memoize that calculation. Note that measuring performance in development will not give accurate results because of Strict Mode double rendering. Build the app for production and test on a device your users have.

## Resetting all state when a prop changes

If a component receives a `userId` prop and you want to clear its `comment` state whenever `userId` changes, do not reset state on prop change in an Effect.

```jsx
export default function ProfilePage({ userId }) {
  const [comment, setComment] = useState('');
  // Avoid: Resetting state on prop change in an Effect
  useEffect(() => {
    setComment('');
  }, [userId]);
  // ...
}
```

This renders `ProfilePage` and its children with the stale value first, then renders again. Split the component in two and pass a `key` attribute from the outer component to the inner one.

```jsx
export default function ProfilePage({ userId }) {
  return (
    <Profile
      userId={userId}
      key={userId}
    />
  );
}

function Profile({ userId }) {
  // Good: This and any other state below will reset on key change automatically
  const [comment, setComment] = useState('');
  // ...
}
```

By passing `userId` as a `key` to the `Profile` component, you ask React to treat two `Profile` components with different `userId` values as two different components. Whenever the key changes, React recreates the DOM and resets the state of the `Profile` component and all its children.

## Adjusting some state when a prop changes

Sometimes you might want to reset or adjust a part of the state on a prop change, but not all of it. If a `List` component receives `items` and maintains a `selection` state, you might want to reset `selection` to null whenever `items` changes. Do not do this in an Effect.

```jsx
function List({ items }) {
  const [isReverse, setIsReverse] = useState(false);
  const [selection, setSelection] = useState(null);
  // Avoid: Adjusting state on prop change in an Effect
  useEffect(() => {
    setSelection(null);
  }, [items]);
  // ...
}
```

Delete the Effect and adjust the state directly during rendering.

```jsx
function List({ items }) {
  const [isReverse, setIsReverse] = useState(false);
  const [selection, setSelection] = useState(null);
  // Better: Adjust the state while rendering
  const [prevItems, setPrevItems] = useState(items);

  if (items !== prevItems) {
    setPrevItems(items);
    setSelection(null);
  }
  // ...
}
```

React will re-render the `List` immediately after it exits with a `return` statement. React has not rendered the `List` children or updated the DOM yet, so this lets the children skip rendering the stale `selection` value. A condition like `items !== prevItems` is necessary to avoid loops. You may adjust state like this, but any other side effects should stay in event handlers or Effects to keep components pure.

Most components should not need this pattern. Always check whether you can reset all state with a key or calculate everything during rendering instead. Store the selected item ID instead of storing the selected item object, and find the item during rendering.

```jsx
function List({ items }) {
  const [isReverse, setIsReverse] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  // Best: Calculate everything during rendering
  const selection = items.find(item => item.id === selectedId) ?? null;
  // ...
}
```

## Sharing logic between event handlers

If you have two buttons that both add a product to the cart and show a notification, do not place this logic in an Effect.

```jsx
function ProductPage({ product, addToCart }) {
  // Avoid: Event-specific logic inside an Effect
  useEffect(() => {
    if (product.isInCart) {
      showNotification(`Added ${product.name} to the shopping cart!`);
    }
  }, [product]);

  function handleBuyClick() {
    addToCart(product);
  }

  function handleCheckoutClick() {
    addToCart(product);
    navigateTo('/checkout');
  }
  // ...
}
```

This Effect causes bugs. If the app remembers the shopping cart between page reloads, the notification will appear every time you refresh the page because `product.isInCart` will be true on load. Delete the Effect and put the shared logic into a function called from both event handlers.

```jsx
function ProductPage({ product, addToCart }) {
  // Good: Event-specific logic is called from event handlers
  function buyProduct() {
    addToCart(product);
    showNotification(`Added ${product.name} to the shopping cart!`);
  }

  function handleBuyClick() {
    buyProduct();
  }

  function handleCheckoutClick() {
    buyProduct();
    navigateTo('/checkout');
  }
  // ...
}
```

Use Effects only for code that should run because the component was displayed to the user. If the logic is caused by a particular interaction, keep it in the event handler.

## Sending a POST request

If a form sends an analytics event when it mounts and a POST request to an API when submitted, the analytics POST request should remain in an Effect because the reason to send the event is that the form was displayed. The API POST request is not caused by the form being displayed. It should only happen when the user presses the button. Delete the Effect for the API request and move that POST request into the event handler.

```jsx
function Form() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Good: This logic runs because the component was displayed
  useEffect(() => {
    post('/analytics/event', { eventName: 'visit_form' });
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    // Good: Event-specific logic is in the event handler
    post('/api/register', { firstName, lastName });
  }
  // ...
}
```

## Chains of computations

Do not chain Effects that each adjust a piece of state based on other state.

```jsx
function Game() {
  const [card, setCard] = useState(null);
  const [goldCardCount, setGoldCardCount] = useState(0);
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  // Avoid: Chains of Effects that adjust the state solely to trigger each other
  useEffect(() => {
    if (card !== null && card.gold) {
      setGoldCardCount(c => c + 1);
    }
  }, [card]);

  useEffect(() => {
    if (goldCardCount > 3) {
      setRound(r => r + 1)
      setGoldCardCount(0);
    }
  }, [goldCardCount]);

  // ...
}
```

This is inefficient because the component and its children have to re-render between each `set` call in the chain. It is also rigid and fragile as requirements change. Calculate what you can during rendering, and adjust the state in the event handler.

```jsx
function Game() {
  const [card, setCard] = useState(null);
  const [goldCardCount, setGoldCardCount] = useState(0);
  const [round, setRound] = useState(1);
  // Good: Calculate what you can during rendering
  const isGameOver = round > 5;

  function handlePlaceCard(nextCard) {
    if (isGameOver) {
      throw Error('Game already ended.');
    }

    // Good: Calculate all the next state in the event handler
    setCard(nextCard);
    if (nextCard.gold) {
      if (goldCardCount < 3) {
        setGoldCardCount(goldCardCount + 1);
      } else {
        setGoldCardCount(0);
        setRound(round + 1);
        if (round === 5) {
          alert('Good game!');
        }
      }
    }
  }
  // ...
}
```

Remember that inside event handlers, state behaves like a snapshot. If you need to use the next value for calculations, define it manually like `const nextRound = round + 1`. In some cases where you cannot calculate the next state directly in the event handler, a chain of Effects is appropriate because you are synchronizing with network.

## Initializing the application

If logic should only run once when the app loads, do not place it in an Effect in the top-level component without a guard. It runs twice in development and can cause issues if the function was not designed to be called twice. If some logic must run once per app load rather than once per component mount, add a top-level variable to track whether it has already executed.

```jsx
let didInit = false;
function App() {
  useEffect(() => {
    if (!didInit) {
      didInit = true;
      // Good: Only runs once per app load
      loadDataFromLocalStorage();
      checkAuthToken();
    }
  }, []);
  // ...
}
```

You can also run it during module initialization at the top level of your root component module before the app renders. Keep app-wide initialization logic to root component modules or in your application's entry point to avoid slowdowns when importing components.

## Notifying parent components about state changes

If a `Toggle` component with internal `isOn` state notifies a parent whenever its state changes, do not call the parent's `onChange` event from an Effect.

```jsx
function Toggle({ onChange }) {
  const [isOn, setIsOn] = useState(false);
  // Avoid: The onChange handler runs too late
  useEffect(() => {
    onChange(isOn);
  }, [isOn, onChange])

  function handleClick() {
    setIsOn(!isOn);
  }
  // ...
}
```

The `Toggle` updates its state first, React updates the screen, and then React runs the Effect to call `onChange`. The parent component then updates its own state, starting another render pass. Delete the Effect and update the state of both components within the same event handler.

```jsx
function Toggle({ onChange }) {
  const [isOn, setIsOn] = useState(false);

  function updateToggle(nextIsOn) {
    // Good: Perform all updates during the event that caused them
    setIsOn(nextIsOn);
    onChange(nextIsOn);
  }

  function handleClick() {
    updateToggle(!isOn);
  }
  // ...
}
```

React batches updates from different components together, so there will only be one render pass. You might also remove the state altogether and receive `isOn` from the parent component. Lifting state up lets the parent component fully control the `Toggle`.

## Passing data to the parent

If a child component fetches data and passes it to the parent in an Effect, the data flow becomes difficult to trace. Let the parent component fetch that data and pass it down to the child instead.

```jsx
function Parent() {
  const data = useSomeAPI();
  // Good: Passing data down to the child
  return <Child data={data} />;
}

function Child({ data }) {
  // ...
}
```

Data flows from the parent components to their children in React.

## Subscribing to an external store

If components need to subscribe to data outside React state from a third-party library or browser API, you might use an Effect with manual state management. React has a purpose-built Hook for subscribing to an external store called `useSyncExternalStore`. Use it instead of an Effect.

```jsx
function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function useOnlineStatus() {
  // Good: Subscribing to an external store with a built-in Hook
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}

function ChatIndicator() {
  const isOnline = useOnlineStatus();
  // ...
}
```

This approach is less error-prone than manually syncing mutable data to React state with an Effect.

## Fetching data

Many apps use Effects to kick off data fetching. You do not need to move this fetch to an event handler. While the user typing in a search box is an event, the main reason to fetch is that the component is visible and you want to keep the results synchronized with the current query and page.

However, a naive fetch in an Effect has a race condition bug. If a user types "hello" fast, separate fetches kick off, but there is no guarantee about which order the responses arrive in. The "hell" response may arrive after the "hello" response, displaying the wrong search results. To fix the race condition, add a cleanup function to ignore stale responses.

```jsx
function SearchResults({ query }) {
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let ignore = false;
    fetchResults(query, page).then(json => {
      if (!ignore) {
        setResults(json);
      }
    });
    return () => {
      ignore = true;
    };
  }, [query, page]);

  function handleNextPageClick() {
    setPage(page + 1);
  }
  // ...
}
```

This ensures that all responses except the last requested one will be ignored. Handling race conditions is not the only difficulty with implementing data fetching. You also need to think about caching responses, fetching data on the server, and avoiding network waterfalls. Modern frameworks provide more efficient built-in data fetching mechanisms than fetching data in Effects.

If you do not use a framework but want to make data fetching from Effects more ergonomic, extract your fetching logic into a custom Hook. The fewer raw `useEffect` calls you have in your components, the easier you will find it to maintain the application. TanStack Query handles caching, invalidation, and refetching for you, so use it instead of raw fetch in an Effect for client-side data fetching.

## Companion: ESLint plugin

[eslint-plugin-react-you-might-not-need-an-effect](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect)
catches unnecessary Effects at lint time. Install it alongside this reference.

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

# Performance

## Code splitting

Split at the route level so the initial load only fetches what's needed for the first screen, and everything else loads lazily as the user navigates. Don't split more granularly than that by default: too many small chunks means too many requests, which can hurt performance instead of helping it.

## State and re-renders

- Don't put everything in one global state object. A single state blob means any update anywhere triggers re-renders everywhere. Split state by where it's actually used.
- Keep state as close as possible to the components that use it. State lifted higher than necessary causes components in between to re-render even though they don't care about the value.
- If a piece of state is initialized from an expensive computation, pass the initializer function to `useState`, not the computed value:

  ```javascript
  // runs the expensive function on every re-render
  const [state, setState] = useState(myExpensiveFn());

  // runs it once, on mount
  const [state, setState] = useState(() => myExpensiveFn());
  ```

- For state that tracks many independent elements at once, consider a store with atomic updates (Zustand, Jotai) instead of one big object.
- React Context is fine for low-frequency data: theme, user info, small local state. For data that updates often, plain context will re-render every consumer on every change. Either use a library with built-in selectors (Zustand, Jotai) or `use-context-selector` if staying with context. And before reaching for context at all, check whether lifting state up or better component composition solves the problem without it. Context is not the default answer to prop drilling.
- If the app updates frequently and runtime styling libraries (emotion, styled-components) show up as a bottleneck, consider a zero-runtime alternative (Tailwind, vanilla-extract, CSS modules) that generates styles at build time instead.

## Use `children` to avoid re-renders

Passing JSX through `children` is the cheapest optimization. Content passed as `children` is a VDOM structure the parent doesn't own and can't re-render. State changes in the parent leave it untouched.

```javascript
// PureComponent re-renders every time count changes
const Counter = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>
      <PureComponent />
    </div>
  );
};

// PureComponent is passed as children, so it's isolated from count updates
const Counter = ({ children }) => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>
      {children}
    </div>
  );
};
```

## Images

Lazy-load images outside the viewport. Use WebP where possible. Use `srcset` so the browser picks the right image size for the screen instead of always loading the largest.

## Web vitals

Check Lighthouse and PageSpeed Insights scores. Search ranking takes web vitals into account, so this isn't purely a UX concern.

## Data prefetching

If you can predict where the user is headed next, prefetch that data with `queryClient.prefetchQuery` (react-query) before they navigate. The data is already cached by the time the page mounts, so there's no loading state to show.

# Checking for over-applied structure

Scope: this file only looks for bulletproof-react conventions applied somewhere they don't earn their cost. It does not check correctness, security, or performance. Those are covered in the other reference files.

Read this when asked to review a React codebase for over-engineering, unnecessary structure, or premature abstraction, or when you've just generated a feature scaffold yourself and want to check it before handing it over.

## What to look for

Walk the `src/features/` tree and check each feature folder against what it actually contains, not what the pattern says a feature folder should have.

- **Empty or near-empty subfolders.** A feature with a `hooks/` folder holding one trivial hook that's only used in one place didn't need the folder. Flat is fine until a second hook shows up.
- **A `stores/` folder for state that never leaves one component.** That's component state, not application state. Creating a store for it is applying the state-management categories from [reference/state-management.md](reference/state-management.md) without checking which category actually applies.
- **A feature folder for something that isn't a feature.** A single reusable button living under `features/checkout/components/` because it was built during checkout work, when it's actually generic UI, belongs in shared `components/` instead.
- **ESLint import-restriction rules copied wholesale for a two-feature app.** The rule from [reference/project-structure.md](reference/project-structure.md) exists to stop cross-feature imports from accumulating unnoticed across a large team. On a two-feature solo project, the enforcement overhead may not be worth it yet. Note it as a candidate to add later, not a mandatory day-one setup.
- **A full request-declaration file (types, fetcher, hook) for a one-off call that isn't part of a feature at all** - a prototype script, a single component with no `features/` folder. [reference/api-layer.md](reference/api-layer.md)'s pattern pays off when endpoints multiply and get reused; for a genuine one-off outside a feature, a plain inline fetch is not a violation.
- **Do not flag a single file inside an existing feature's `api/` folder just because there's only one endpoint.** If the feature already has a folder (e.g. `features/user-settings/`), `api/update-settings.ts` is the pattern starting correctly, not over-applied. One file in `api/` is how every feature's API layer begins. Flag empty `stores/`, a single-use `hooks/`, or a single-type `types/` folder instead - not a lone `api/` file already wired into a real feature.

## Reporting format

One line per finding: location, what's over-applied, what it should be instead.

```
features/notifications/stores/notification-store.ts: unnecessary store, state only used in NotificationBell. Move to local useState.
features/checkout/components/icon-button.tsx: not checkout-specific, move to shared components/.
```

Don't write paragraphs explaining why each finding matters, the reference file it points back to already explains the rule. Just say what to cut and where it goes instead.

If nothing here is over-applied, say so in one line. A clean scan is a valid outcome, not a reason to invent findings.

# Quality check tools

These tools and companion skills enforce or extend the conventions in this skill. Use them when the task goes beyond organizing files: when you need to verify code quality, catch performance issues, or design better component APIs.

## react-doctor

Scans your React codebase for issues across state and effects, performance, architecture, security, and accessibility. Run it after applying this skill's conventions to catch what the agent missed.

```bash
npx react-doctor@latest
```

Works with Next.js, Vite, TanStack, React Native, Expo. Can run in CI on pull requests. 13.5k stars.

Notable: react-doctor catches exactly the kinds of problems this skill teaches you to avoid: state in the wrong place, barrel files breaking tree shaking, missing error boundaries. The two tools complement each other.

[https://github.com/millionco/react-doctor](https://github.com/millionco/react-doctor)

## Vercel react-best-practices

70 rules across 8 categories, prioritized by impact: eliminating waterfalls, bundle size, server-side performance, client-side data fetching, re-render optimization, rendering performance, JavaScript performance, and advanced patterns.

Load this skill when performance is the specific concern, not just "where do I put these files" but "why is this page slow and how do I fix it."

```bash
npx skills add vercel-labs/agent-skills --skill react-best-practices
```

[https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)

## Vercel composition-patterns

Component architecture patterns: compound components with shared context, avoiding boolean prop proliferation, lifting state into providers, and React 19 API changes (no more `forwardRef`, `use()` instead of `useContext()`).

Load this skill when designing component APIs, not file organization but the contract between a component and its callers.

```bash
npx skills add vercel-labs/agent-skills --skill composition-patterns
```

[https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns)
