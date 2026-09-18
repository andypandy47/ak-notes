# AGENTS.md

## Frontend implementation rules

These rules are mandatory for all frontend work.

### Components

- ALWAYS use existing shadcn/ui components where an appropriate component exists.
- DO NOT create custom implementations of buttons, dialogs, inputs, selects,
  checkboxes, tabs, cards, badges, tooltips, dropdowns, or other primitives
  if an equivalent exists under `app/src/components/ui`.
- Before implementing a UI primitive, inspect `app/src/components/ui` for an existing
  shadcn component.
- Compose existing shadcn components rather than copying their implementation.
- Do not modify shadcn components under `app/src/components/ui` unless the task
  explicitly requires changing the shared component.

### Tailwind

- Use Tailwind CSS for styling.
- Do not use inline `style` attributes.
- Do not create CSS modules unless explicitly requested.
- Do not use arbitrary values such as:
  - `w-[317px]`
  - `text-[#123456]`
  - `mt-[13px]`
    unless there is no equivalent design token or Tailwind utility.
- Prefer spacing from the Tailwind scale:
  `gap-2`, `gap-4`, `p-4`, `mt-6`, etc.
- Prefer semantic design-system colors such as:
  `bg-background`, `text-foreground`, `text-muted-foreground`,
  `border-border`, `bg-primary`.
- Do not use raw palette colors such as `text-gray-500` when a semantic token
  exists.
- Use `cn()` for conditional class composition.
- Put responsive classes alongside their base class:
  `grid grid-cols-1 md:grid-cols-2`.
- Prefer `gap-*` on container elements rather than margins between children.

### Before completing frontend work

Review every changed frontend file and verify:

1. Existing shadcn components were reused where possible.
2. No unnecessary custom UI primitives were introduced.
3. No arbitrary Tailwind values were introduced unnecessarily.
4. Semantic design tokens are used instead of raw colours.
5. `cn()` is used for conditional class names.

### Linting and formatting

- After making code changes, run `npx oxlint --fix`, then run `npx oxfmt`.
- Before finishing, run `npx oxlint --deny-warnings --format=agent`.
- Always use {} where possible. Dont skip brackets.

### Api requests

All api requests should be implemented using tanstack query and react hooks. Each endpoint needed to be called should be implemented as it's own reusable query or mutation hook which can then be
pulled into components.

### Tanstack

- When writing TanStack queries and mutations, keep abstraction to a minimum.
- Write query and mutation options directly in `useQuery` and `useMutation`; do not extract
  single-use options objects.
- Keep the complete async workflow for a query or mutation—including SQL calls and the
  associated encryption/decryption calls—directly inside its `queryFn` or `mutationFn` when
  that workflow is only used by that hook.
- Do not extract single-use async query or mutation workflows into repository functions,
  service methods, or local helper functions that merely forward their result to one hook.
- Extract an async operation only when it has multiple genuine callers or represents a shared
  primitive independently of TanStack Query. Synchronous schemas, constants, parsing helpers,
  and query-key factories may remain shared where useful.
