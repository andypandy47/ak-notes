# Frontend architecture

The frontend follows Bulletproof React's dependency direction: shared code is used by features, and the app layer composes features. Import files directly; do not add barrel exports.

- `src/app/app.tsx`: application composition and future providers or routes.
- `src/features/notes/components/`: notebook composition, sidebar, page list, toolbar, note page, and block-editor adapter.
- `src/features/notes/context/`: typed notebook context and its provider, which owns session-only page state, selection, search, creation, and updates. The app layer injects one provider per notebook.
- `src/features/notes/hooks/use-notebook.ts`: reads the shared context and throws a clear error outside its provider. Sidebar, page list, toolbar, and note page consume this hook directly instead of receiving notebook props. Updates take an explicit page ID and can only change title or blocks.
- `src/features/notes/types.ts`: note-specific types.
- `src/features/notes/data/demo-pages.ts`: prototype seed content, cloned for each notebook instance.
- Notes components use Tailwind utilities, responsive variants, and semantic theme colors. BlockNote-specific adjustments use scoped arbitrary variants in `note-editor.tsx`; its vendor stylesheet remains required.
- `src/components/ui/`: shared shadcn primitives; must not import features.
- `src/lib/` and `src/utils/`: shared helpers; must not import features or the app layer.
- `src/App.css`: global theme and Tailwind configuration, loaded by `main.tsx`.

Sidebar visibility belongs to shadcn's `SidebarProvider`, composed in the notebook. `NotebookSidebar` uses Sidebar header, content, footer, group, and menu primitives. On mobile it opens as a sheet and closes after page selection or creation. The sidebar shortcut ignores editable fields so it does not intercept editor formatting. The page collection and selection belong to `NotebookProvider`; components call context methods in their own event handlers. The editor owns its editing state and reports document changes through a callback; its page-ID key ensures a fresh editor on page switches.

There is no server data yet, so no query client, global store, router, or empty API layer has been introduced. When the backend exists, its server state should use a query cache rather than a general-purpose store. Offline drafts and synchronization need a separate design before replacing the current in-memory prototype.

The dependency boundaries above are conventions for now, not ESLint-enforced rules.
