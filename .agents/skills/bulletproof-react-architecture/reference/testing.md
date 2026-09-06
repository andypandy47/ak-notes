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
