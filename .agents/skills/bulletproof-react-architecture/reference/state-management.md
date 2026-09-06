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
