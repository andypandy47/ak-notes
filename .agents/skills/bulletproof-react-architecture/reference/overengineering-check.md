<!-- source: original to this skill, not derived from bulletproof-react docs -->

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
