---
name: bulletproof-react-architecture
description: Apply bulletproof-react conventions when writing, organizing, or reviewing React or TypeScript apps. Covers feature-based folder structure, API layers, state management categories, testing strategy, error handling, auth, and performance. Use whenever the user creates a new React feature, sets up project structure, asks "where does this go" or "how should I organize this", decides where state lives, writes data-fetching or auth code, or asks for a React architecture review. Triggers on "feature folder", "React project structure", "should I use Redux", "how to structure API calls".
---

# Bulletproof React architecture

Source: [bulletproof-react](https://github.com/alan2207/bulletproof-react) by Alan Alickovic, MIT licensed. The upstream repo is now a monorepo with three app variants: `apps/react-vite/`, `apps/nextjs-app/`, `apps/nextjs-pages/`. This skill follows the `react-vite` version as primary. See [NOTICE.md](NOTICE.md) for the license and adaptation note.

## Vocabulary

Use these terms exactly. Don't substitute "module," "service," or "component" where the repo means "feature."

- **Feature**: a self-contained folder under `src/features/`, holding everything specific to one piece of product functionality: its own `api/`, `components/`, `hooks/`, `stores/`, `types/`.
- **Shared code**: anything in the top-level `components/`, `hooks/`, `lib/`, `types/`, `utils/`. Usable from any feature or from the app layer. Never depends on a feature.
- **App layer**: `src/app/`, meaning routes, root component, providers, router config. The only layer allowed to compose multiple features together.

## Rules of thumb

A scannable summary. Each one is expanded in the reference files linked below.

| Rule | What it means |
|------|--------------|
| No cross-feature imports | `features/comments` importing from `features/discussions` is always a bug. Promote to shared code. |
| Code flows one direction | shared → features → app. Never the reverse. Nothing in shared imports from a feature or app. |
| Match state to category first | Component, app, server cache, form, and URL state are five different problems with five different tools. |

## Before you apply this

This pays off when the app has multiple features, multiple contributors, or a timeline longer than a few months. It does not pay off on a five-file prototype, a one-off script, or a throwaway component.

Check scale before reaching for structure:

- **One feature, a handful of files?** Keep `src/` flat. The full feature-folder skeleton for one component and one fetch call is the failure mode this skill exists to prevent, not the goal.
- **Already have a working pattern in this codebase?** Match it. Two competing conventions cost more than either one's imperfections.
- **Unsure whether a rule applies?** Ask what breaks without it. If nothing breaks, skip it.

The reference files below aren't a checklist. Each solves one problem. Read the one that matches the problem in front of you.

## When this skill doesn't apply

Skip it for non-structural work: fixing a bug, writing a single function, styling a component. If the question isn't "where does this go" or "how should this be organized," you don't need it.

This skill assumes you apply judgment about scale. If you catch yourself building every subfolder from the project-structure file just because it's listed, stop and ask whether this feature actually needs all of them.

## Gotchas

The mistakes the agent makes most often:

1. **Using `react-router-dom`.** The upstream repo moved to `react-router` v7 (library mode). Import from `react-router`, not `react-router-dom`.
2. **Creating a store for state that never leaves one component.** That's component state, not application state. Start with `useState`. Promote to a store only when another component actually needs the same value.
3. **Building the full feature skeleton for a small feature.** A feature with one component and one fetch call doesn't need `api/`, `components/`, `hooks/`, `stores/`, `types/`. Just `api/` and `components/` is fine. You can add folders later when they earn their keep.
4. **Putting server cache state in Zustand, Redux, or any general-purpose store.** Server data belongs in TanStack Query's cache, not in a hand-rolled store. The caching, invalidation, and refetching logic a query client gives you for free is the whole reason it exists.
5. **Barrel files (index.ts that re-exports everything).** They break tree shaking in Vite. Import directly from the file you need.
6. **Cross-feature imports.** Worth repeating: `features/comments` reaching into `features/discussions` is never the right call. If two features share logic, promote it to shared code.
7. **Flagging a single `api/` file as over-engineering.** One endpoint in `features/x/api/` is how the API layer starts, not a violation. The over-engineering check targets empty `stores/`, single-use `hooks/`, and single-type `types/` folders, or truly one-off inline fetches outside a feature entirely - not a lone `api/` file already living inside a real feature folder.
8. **Reaching for `useEffect` to transform data or handle user events.** If something can be calculated from existing props or state, calculate it during rendering. If logic runs because the user did something, put it in the event handler. Effects are for synchronizing with external systems only. See [reference/effects.md](reference/effects.md).

## These resources may help

Each file is short enough to load in full. Read the one relevant to the current task.

- **[reference/project-structure.md](reference/project-structure.md)**: app and feature folder layout, the ESLint rules enforcing the import direction above. Start here for a new feature or any "where does this go" question. Most-read file in the skill.

- **[reference/api-layer.md](reference/api-layer.md)**: request declaration structure: types, fetcher, hook. Read when writing or reviewing data-fetching code.

- **[reference/state-management.md](reference/state-management.md)**: the five state categories, with a library recommendation for each. Read before adding a `useState`, context, or store. Picking the tool before the category usually means picking wrong.

- **[reference/testing.md](reference/testing.md)**: test types, where to weight effort, tooling (Vitest, Testing Library, Playwright, MSW).

- **[reference/error-handling.md](reference/error-handling.md)**: API error interception, error boundary placement, production error tracking. Short, read in full.

- **[reference/security.md](reference/security.md)**: token storage, authorization models (RBAC, PBAC). Read in full, not selectively. Storage and sanitization guidance depend on each other; skipping a section here risks a real vulnerability, not just wasted time.

- **[reference/performance.md](reference/performance.md)**: code splitting, re-render causes, the `children` pattern, image and prefetch optimizations. Read when something is measurably slow, not preemptively.

- **[reference/overengineering-check.md](reference/overengineering-check.md)**: a narrow review pass for this skill's own conventions applied where they don't earn their cost. Read when reviewing a codebase for unnecessary structure, or as a self-check after generating a feature scaffold.

- **[reference/effects.md](reference/effects.md)**: when to avoid Effects and what to do instead. Covers derived state, `useMemo`, resetting state with keys, chains of computations, fetching with cleanup, and more. Read before reaching for `useEffect`.

- **[reference/quality-check.md](reference/quality-check.md)**: companion tools (react-doctor, Vercel performance rules, composition patterns) that enforce or extend these conventions.
