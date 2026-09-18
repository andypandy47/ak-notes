# Frontend architecture

The frontend follows Bulletproof React's dependency direction: shared code is used by features, and the app layer composes features. Import files directly; do not add barrel exports.

- `src/app/app.tsx`: application composition and future providers or routes.
- `src/features/notes/components/`: notebook composition, sidebar, page list, toolbar, note page, and block-editor adapter.
- `src/features/notes/context/`: typed notebook context and its provider, which owns selection, search, creation, and debounced local updates. Page data itself is derived from TanStack Query entries backed by the encrypted local repository.
- `src/features/notes/data/local-pages.ts`: the only frontend module that talks directly to the Tauri SQL plugin. It encrypts documents and summaries before writing them to device-local SQLite.
- `src/features/notes/hooks/use-local-pages.ts`: query and mutation hooks over the local repository. The query cache exposes local data to React but is not the durable store.
- `src/features/sync/`: owns remote page requests, the SQLite sync repository, the framework-independent sync cycle, and the React provider/hook that expose derived sync state. The first implementation pushes queued pages and scans remote summaries for newer revisions; it deliberately has no change feed or automatic conflict merge.
- `src/features/notes/hooks/use-notebook.ts`: reads the shared context and throws a clear error outside its provider. Sidebar, page list, toolbar, and note page consume this hook directly instead of receiving notebook props. Updates take an explicit page ID and can only change title or blocks.
- `src/features/notes/types.ts`: note-specific types.
- `src/features/notes/data/demo-pages.ts`: prototype seed content, cloned for each notebook instance.
- Notes components use Tailwind utilities, responsive variants, and semantic theme colors. BlockNote-specific adjustments use scoped arbitrary variants in `note-editor.tsx`; its vendor stylesheet remains required.
- `src/components/ui/`: shared shadcn primitives; must not import features.
- `src/lib/` and `src/utils/`: shared helpers; must not import features or the app layer.
- `src/App.css`: global theme and Tailwind configuration, loaded by `main.tsx`.

Sidebar visibility belongs to shadcn's `SidebarProvider`, composed in the notebook. `NotebookSidebar` uses Sidebar header, content, footer, group, and menu primitives. On mobile it opens as a sheet and closes after page selection or creation. The sidebar shortcut ignores editable fields so it does not intercept editor formatting. The page collection and selection belong to `NotebookProvider`; components call context methods in their own event handlers. The editor owns its editing state and reports document changes through a callback; its page-ID key ensures a fresh editor on page switches.

The local SQLite database containing encrypted page data is the notebook's durable working copy. Each local page upsert also queues its pending sync operation through a SQLite trigger in the same transaction. Sync runs after unlock, after a local commit, and when connectivity returns. A revision conflict keeps the local operation queued and reports an error; richer conflict handling and an incremental server feed can replace this simple policy later without changing notes components.

Device data is isolated by Tauri identifier: local, preview, and production use
`com.aknotes.local`, `com.aknotes.preview`, and `com.aknotes`, respectively. This gives each
environment its own SQLite database and Stronghold state. Within those directories, saved API
credentials use `credential-local.hold`, `credential-preview.hold`, and `credential.hold`. Only
the matching snapshot is detected, unlocked, or removed by a build. Build configuration is parsed once
through the Zod schema in `src/config/environment.ts` and consumed through its `env` object.

The dependency boundaries above are conventions for now, not ESLint-enforced rules.
