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
